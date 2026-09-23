-- JustGlance v2.3.0 — Contacts + Universal Memory / AI Intake
-- ADDITIVE / MIGRATION-SAFE. Safe to run after previous JustGlance migrations.
-- Existing tasks, events, captures, shopping data, spaces, invites and projects are preserved.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  first_name text,
  last_name text,
  display_name text not null,
  nickname text,
  relationship text,
  company text,
  job_title text,
  email_personal text,
  email_work text,
  phone_mobile text,
  phone_home text,
  phone_work text,
  address_home text,
  address_business text,
  birthday date,
  notes text,
  tags text[] not null default '{}',
  avatar_url text,
  linked_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table if exists public.items
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

alter table if exists public.events
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

-- Expand the durable capture kinds without replacing any rows.
do $$
declare c record;
begin
  if to_regclass('public.captures') is not null then
    for c in
      select conname from pg_constraint
      where conrelid = 'public.captures'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%kind%'
        and pg_get_constraintdef(oid) ilike '%calendar_import%'
    loop
      execute format('alter table public.captures drop constraint if exists %I', c.conname);
    end loop;
  end if;
end $$;

alter table public.captures
  add constraint captures_kind_check
  check (kind in ('thought','text','link','file','image','calendar_import','contact_import'));

alter table if exists public.captures
  add column if not exists contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists ai_status text not null default 'not_requested',
  add column if not exists ai_summary text,
  add column if not exists ai_entities jsonb not null default '{}'::jsonb,
  add column if not exists ai_suggestions jsonb not null default '{}'::jsonb;

-- Relax the AI status constraint safely when a previous development version created one.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.captures'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%ai_status%'
  loop
    execute format('alter table public.captures drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.captures
  add constraint captures_ai_status_check
  check (ai_status in ('not_requested','queued','processing','analyzed','error'));

create index if not exists contacts_user_name_idx
  on public.contacts(user_id, lower(display_name))
  where deleted_at is null;
create index if not exists contacts_user_company_idx
  on public.contacts(user_id, lower(company))
  where deleted_at is null and company is not null;
create index if not exists items_contact_idx
  on public.items(contact_id, status)
  where contact_id is not null and deleted_at is null;
create index if not exists events_contact_idx
  on public.events(contact_id, event_date)
  where contact_id is not null and deleted_at is null;
create index if not exists captures_ai_status_idx
  on public.captures(user_id, ai_status, created_at desc);

-- Ensure the common updated_at trigger helper exists even on a partially repaired schema.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

alter table public.contacts enable row level security;

drop policy if exists contacts_select_self on public.contacts;
create policy contacts_select_self on public.contacts for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);

drop policy if exists contacts_insert_self on public.contacts;
create policy contacts_insert_self on public.contacts for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists contacts_update_self on public.contacts;
create policy contacts_update_self on public.contacts for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists contacts_delete_self on public.contacts;
create policy contacts_delete_self on public.contacts for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.contacts to authenticated;

-- Keep contact ownership immutable.
create or replace function public.protect_contact_identity()
returns trigger language plpgsql as $$
begin
  if tg_op='UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'Contact owner cannot be changed';
  end if;
  return new;
end $$;

drop trigger if exists contacts_updated_at on public.contacts;
create trigger contacts_updated_at before update on public.contacts
for each row execute function public.set_updated_at();

drop trigger if exists contacts_identity_guard on public.contacts;
create trigger contacts_identity_guard before update on public.contacts
for each row execute function public.protect_contact_identity();

-- Prevent linking a task/event to another user's private contact.
create or replace function public.validate_item_contact()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.contact_id is not null and not exists(
    select 1 from public.contacts c where c.id=new.contact_id and c.user_id=new.user_id and c.deleted_at is null
  ) then
    raise exception 'Contact must belong to the item creator';
  end if;
  return new;
end $$;

drop trigger if exists items_contact_guard on public.items;
create trigger items_contact_guard before insert or update of contact_id,user_id on public.items
for each row execute function public.validate_item_contact();

create or replace function public.validate_event_contact()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.contact_id is not null and not exists(
    select 1 from public.contacts c where c.id=new.contact_id and c.user_id=new.user_id and c.deleted_at is null
  ) then
    raise exception 'Contact must belong to the event creator';
  end if;
  return new;
end $$;

drop trigger if exists events_contact_guard on public.events;
create trigger events_contact_guard before insert or update of contact_id,user_id on public.events
for each row execute function public.validate_event_contact();

-- Realtime makes contact changes appear on other signed-in devices quickly.
do $$ begin
  alter publication supabase_realtime add table public.contacts;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';

-- Diagnostic: all values should be true after a successful run.
select
  to_regclass('public.contacts') is not null as contacts_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='items' and column_name='contact_id') as item_contact_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='contact_id') as event_contact_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='captures' and column_name='ai_status') as capture_ai_ready,
  has_table_privilege('authenticated','public.contacts','SELECT') as contacts_auth_ready;
