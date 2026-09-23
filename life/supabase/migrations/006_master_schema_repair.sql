-- JustGlance v2.3.1 MASTER SCHEMA REPAIR
-- Migration-safe/idempotent repair for the current JustGlance schema through migration 005.
-- Preserves existing rows. It does not DROP user data tables.
-- Safe to rerun after a partial migration failure.

create schema if not exists extensions;
DO $$
DECLARE ext_schema text;
BEGIN
  SELECT n.nspname INTO ext_schema
  FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
  WHERE e.extname='pgcrypto';
  IF ext_schema IS NULL THEN
    EXECUTE 'CREATE EXTENSION pgcrypto WITH SCHEMA extensions';
  ELSIF ext_schema <> 'extensions' THEN
    -- pgcrypto is relocatable; normalize its location so all JustGlance functions
    -- can call extensions.digest / extensions.gen_random_bytes consistently.
    EXECUTE 'ALTER EXTENSION pgcrypto SET SCHEMA extensions';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='space_role') THEN
    CREATE TYPE public.space_role AS ENUM ('owner','admin','member');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='item_status') THEN
    CREATE TYPE public.item_status AS ENUM ('open','completed','dismissed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='item_priority') THEN
    CREATE TYPE public.item_priority AS ENUM ('low','normal','high');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='item_type') THEN
    CREATE TYPE public.item_type AS ENUM ('task','shopping','call','errand','reminder','idea','chore');
  END IF;
END $$;


-- ===== CORE SCHEMA (idempotent form of migration 001) =====
-- JustGlance production schema
-- Run in Supabase SQL editor or through `supabase db push`.


create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default 'User',
  greeting_name text not null default 'there',
  avatar_url text,
  timezone text not null default 'America/New_York',
  wake_time time not null default '07:00',
  sleep_time time not null default '23:00',
  work_start time,
  work_end time,
  work_days smallint[] not null default array[1,2,3,4,5],
  theme text not null default 'system' check (theme in ('light','dark','system')),
  week_starts_on smallint not null default 0 check (week_starts_on between 0 and 6),
  time_format text not null default '12h' check (time_format in ('12h','24h')),
  onboarding_complete boolean not null default false,
  help_areas text[] not null default array['Everything'],
  location_permission_state text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  icon text not null default 'home',
  is_personal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.space_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (space_id,user_id)
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null default 'other',
  address text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  radius_meters integer not null default 200 check (radius_meters between 25 and 10000),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  description text,
  type public.item_type not null default 'task',
  status public.item_status not null default 'open',
  priority public.item_priority not null default 'normal',
  due_date date,
  due_time time,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 1440),
  place_id uuid references public.places(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  recurrence_rule text,
  context_tags text[] not null default '{}',
  source_text text,
  parser_result jsonb,
  snoozed_until timestamptz,
  snooze_count integer not null default 0 check (snooze_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

-- Optional extension data for shopping-specific attributes while the base item remains canonical.
create table if not exists public.shopping_items (
  item_id uuid primary key references public.items(id) on delete cascade,
  quantity numeric(10,2),
  unit text,
  preferred_store text,
  estimated_price numeric(12,2) check (estimated_price is null or estimated_price >= 0),
  aisle_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  event_date date not null,
  start_time time not null,
  end_time time,
  location text,
  notes text,
  attendees jsonb not null default '[]'::jsonb,
  recurrence_rule text,
  provider text not null default 'internal',
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  title text not null,
  type public.item_type not null default 'task',
  recurrence_rule text not null,
  default_time time,
  estimated_minutes integer,
  priority public.item_priority not null default 'normal',
  enabled boolean not null default true,
  last_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  title text not null default 'Note',
  body text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.item_history (
  id bigint generated by default as identity primary key,
  item_id uuid not null references public.items(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  morning_brief_enabled boolean not null default true,
  daily_reset_enabled boolean not null default true,
  smart_suggestions_enabled boolean not null default true,
  urgent_reminders_enabled boolean not null default true,
  upcoming_tasks_enabled boolean not null default true,
  shared_activity_enabled boolean not null default true,
  location_reminders_enabled boolean not null default false,
  routine_reminders_enabled boolean not null default true,
  default_mood text not null default 'nothing',
  feature_overrides jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  summary_date date not null,
  completed_count integer not null default 0,
  carried_count integer not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id,summary_date)
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_title text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  invite_email text,
  role public.space_role not null default 'member',
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.device_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_key text not null,
  platform text not null default 'web',
  notification_preferences jsonb not null default '{}'::jsonb,
  push_token text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id,device_key)
);

create index if not exists items_user_status_due_idx on public.items(user_id,status,due_date) where deleted_at is null;
create index if not exists items_space_status_idx on public.items(space_id,status) where deleted_at is null;
create index if not exists items_assigned_idx on public.items(assigned_to,status) where deleted_at is null;
create index if not exists items_place_idx on public.items(place_id,status) where deleted_at is null;
create index if not exists items_tags_gin_idx on public.items using gin(context_tags);
create index if not exists events_user_date_idx on public.events(user_id,event_date,start_time) where deleted_at is null;
create index if not exists events_space_date_idx on public.events(space_id,event_date) where deleted_at is null;
create index if not exists notes_user_idx on public.notes(user_id,created_at desc) where deleted_at is null;
create index if not exists activity_user_idx on public.activity_log(user_id,created_at desc);
create index if not exists activity_space_idx on public.activity_log(space_id,created_at desc);
create index if not exists invites_space_idx on public.invites(space_id,expires_at);
create index if not exists places_user_idx on public.places(user_id,name);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists spaces_updated on public.spaces;
create trigger spaces_updated before update on public.spaces for each row execute function public.set_updated_at();

create or replace function public.protect_space_identity() returns trigger language plpgsql as $$
begin
  if new.owner_id is distinct from old.owner_id then raise exception 'Space owner cannot be changed directly'; end if;
  if new.is_personal is distinct from old.is_personal then raise exception 'Personal-space status cannot be changed'; end if;
  return new;
end $$;
drop trigger if exists spaces_identity_guard on public.spaces;
create trigger spaces_identity_guard before update on public.spaces for each row execute function public.protect_space_identity();

create or replace function public.protect_space_owner_membership() returns trigger language plpgsql as $$
declare expected_owner uuid; target_space uuid;
begin
  target_space := case when tg_op='DELETE' then old.space_id else new.space_id end;
  select owner_id into expected_owner from public.spaces where id=target_space;
  if tg_op='DELETE' and old.user_id=expected_owner then raise exception 'Space owner membership cannot be deleted'; end if;
  if tg_op='UPDATE' and old.user_id=expected_owner and (new.user_id is distinct from old.user_id or new.role <> 'owner') then raise exception 'Space owner membership cannot be changed'; end if;
  if tg_op in ('INSERT','UPDATE') and new.role='owner' and new.user_id<>expected_owner then raise exception 'Owner role is reserved for the space owner'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists space_members_owner_guard on public.space_members;
create trigger space_members_owner_guard before insert or update or delete on public.space_members for each row execute function public.protect_space_owner_membership();

drop trigger if exists places_updated on public.places;
create trigger places_updated before update on public.places for each row execute function public.set_updated_at();
drop trigger if exists items_updated on public.items;
create trigger items_updated before update on public.items for each row execute function public.set_updated_at();

create or replace function public.protect_item_identity() returns trigger language plpgsql as $$
begin
  if tg_op='UPDATE' and new.user_id is distinct from old.user_id then raise exception 'Item creator cannot be changed'; end if;
  if tg_op='UPDATE' and new.space_id is distinct from old.space_id and old.user_id<>auth.uid() then raise exception 'Only the item creator can move it between spaces'; end if;
  if new.assigned_to is not null and new.space_id is null and new.assigned_to<>new.user_id then raise exception 'Personal items cannot be assigned to another user'; end if;
  if new.assigned_to is not null and new.space_id is not null and not exists(select 1 from public.space_members m where m.space_id=new.space_id and m.user_id=new.assigned_to) then raise exception 'Assignee must belong to the shared space'; end if;
  return new;
end $$;
drop trigger if exists items_identity_guard on public.items;
create trigger items_identity_guard before insert or update on public.items for each row execute function public.protect_item_identity();

drop trigger if exists shopping_updated on public.shopping_items;
create trigger shopping_updated before update on public.shopping_items for each row execute function public.set_updated_at();
drop trigger if exists events_updated on public.events;
create trigger events_updated before update on public.events for each row execute function public.set_updated_at();
drop trigger if exists routines_updated on public.routines;
create trigger routines_updated before update on public.routines for each row execute function public.set_updated_at();
drop trigger if exists notes_updated on public.notes;
create trigger notes_updated before update on public.notes for each row execute function public.set_updated_at();

create or replace function public.protect_creator_identity() returns trigger language plpgsql as $$
begin
  if new.user_id is distinct from old.user_id then raise exception 'Creator cannot be changed'; end if;
  return new;
end $$;
drop trigger if exists events_creator_guard on public.events;
create trigger events_creator_guard before update on public.events for each row execute function public.protect_creator_identity();
drop trigger if exists routines_creator_guard on public.routines;
create trigger routines_creator_guard before update on public.routines for each row execute function public.protect_creator_identity();
drop trigger if exists notes_creator_guard on public.notes;
create trigger notes_creator_guard before update on public.notes for each row execute function public.protect_creator_identity();

drop trigger if exists preferences_updated on public.user_preferences;
create trigger preferences_updated before update on public.user_preferences for each row execute function public.set_updated_at();

create or replace function public.is_space_member(p_space uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.space_members m where m.space_id=p_space and m.user_id=auth.uid())
$$;
create or replace function public.can_manage_space(p_space uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.space_members m where m.space_id=p_space and m.user_id=auth.uid() and m.role in ('owner','admin'))
$$;

create or replace function public.get_accessible_space_members()
returns table(space_id uuid, user_id uuid, role public.space_role, display_name text, greeting_name text, avatar_url text)
language sql stable security definer set search_path=public as $$
  select m.space_id, m.user_id, m.role, p.display_name, p.greeting_name, p.avatar_url
  from public.space_members m
  join public.profiles p on p.id=m.user_id
  where public.is_space_member(m.space_id)
$$;
revoke all on function public.get_accessible_space_members() from public;
grant execute on function public.get_accessible_space_members() to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
declare p_name text; p_space uuid;
begin
  p_name := coalesce(nullif(new.raw_user_meta_data->>'display_name',''), nullif(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'name',''), split_part(coalesce(new.email,'User'),'@',1), 'User');
  insert into public.profiles(id,email,display_name,greeting_name,timezone)
  values(new.id,new.email,p_name,p_name,coalesce(new.raw_user_meta_data->>'timezone','America/New_York'))
  on conflict(id) do nothing;
  insert into public.user_preferences(user_id) values(new.id) on conflict do nothing;
  insert into public.spaces(owner_id,name,icon,is_personal) values(new.id,'Personal','sparkles',true) returning id into p_space;
  insert into public.space_members(space_id,user_id,role) values(p_space,new.id,'owner');
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.create_space_with_owner(p_name text, p_icon text default 'home')
returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if char_length(trim(p_name)) < 1 then raise exception 'Space name is required'; end if;
  insert into public.spaces(owner_id,name,icon) values(auth.uid(),trim(p_name),coalesce(nullif(p_icon,''),'home')) returning id into sid;
  insert into public.space_members(space_id,user_id,role) values(sid,auth.uid(),'owner');
  return sid;
end $$;
revoke all on function public.create_space_with_owner(text,text) from public;
grant execute on function public.create_space_with_owner(text,text) to authenticated;

create or replace function public.create_space_invite(p_space uuid, p_email text default null, p_role public.space_role default 'member')
returns text language plpgsql security definer set search_path=public as $$
declare raw_token text; hashed text;
begin
  if not public.can_manage_space(p_space) then raise exception 'Not allowed'; end if;
  if p_role='owner' then raise exception 'Owner role cannot be invited'; end if;
  raw_token := encode(extensions.gen_random_bytes(24),'hex'); hashed := encode(extensions.digest(convert_to(raw_token,'UTF8'),'sha256'::text),'hex');
  insert into public.invites(space_id,created_by,invite_email,role,token_hash) values(p_space,auth.uid(),lower(nullif(trim(p_email),'')),p_role,hashed);
  return raw_token;
end $$;
revoke all on function public.create_space_invite(uuid,text,public.space_role) from public;
grant execute on function public.create_space_invite(uuid,text,public.space_role) to authenticated;

create or replace function public.consume_space_invite(p_token text)
returns uuid language plpgsql security definer set search_path=public as $$
declare inv public.invites%rowtype; hashed text; current_email text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  hashed := encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'::text),'hex');
  select * into inv from public.invites where token_hash=hashed and accepted_at is null and expires_at>now() for update;
  if not found then raise exception 'Invite is invalid or expired'; end if;
  select lower(email) into current_email from public.profiles where id=auth.uid();
  if inv.invite_email is not null and lower(inv.invite_email) <> current_email then raise exception 'Invite belongs to another email'; end if;
  if exists(select 1 from public.spaces where id=inv.space_id and is_personal) then raise exception 'Personal spaces cannot be shared'; end if;
  insert into public.space_members(space_id,user_id,role) values(inv.space_id,auth.uid(),inv.role)
    on conflict(space_id,user_id) do update set role=excluded.role;
  update public.invites set accepted_by=auth.uid(),accepted_at=now() where id=inv.id;
  return inv.space_id;
end $$;
revoke all on function public.consume_space_invite(text) from public;
grant execute on function public.consume_space_invite(text) to authenticated;

create or replace function public.get_space_members(p_space uuid)
returns table(user_id uuid, display_name text, avatar_url text, role public.space_role)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_space_member(p_space) then raise exception 'Not allowed'; end if;
  return query
    select m.user_id,p.display_name,p.avatar_url,m.role
    from public.space_members m
    join public.profiles p on p.id=m.user_id
    where m.space_id=p_space
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,p.display_name;
end $$;
revoke all on function public.get_space_members(uuid) from public;
grant execute on function public.get_space_members(uuid) to authenticated;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path=public,auth as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from auth.users where id=auth.uid();
end $$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

create or replace function public.log_item_history() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.item_history(item_id,actor_id,action,new_values) values(new.id,auth.uid(),'created',to_jsonb(new));
    return new;
  elsif tg_op='UPDATE' then
    insert into public.item_history(item_id,actor_id,action,old_values,new_values) values(new.id,auth.uid(),case when old.status <> new.status and new.status='completed' then 'completed' else 'updated' end,to_jsonb(old),to_jsonb(new));
    return new;
  end if;
  return new;
end $$;
drop trigger if exists items_history on public.items;
create trigger items_history after insert or update on public.items for each row execute function public.log_item_history();

create or replace function public.log_item_activity() returns trigger
language plpgsql security definer set search_path=public as $$
declare actor text; action_name text;
begin
  select greeting_name into actor from public.profiles where id=auth.uid();
  action_name := case when tg_op='INSERT' then 'added' when new.status='completed' and old.status is distinct from new.status then 'completed' else 'updated' end;
  insert into public.activity_log(user_id,space_id,actor_id,actor_name,action,entity_type,entity_id,entity_title)
  values(new.user_id,new.space_id,auth.uid(),actor,action_name,new.type::text,new.id,new.title);
  return new;
end $$;
drop trigger if exists items_activity on public.items;
create trigger items_activity after insert or update on public.items for each row execute function public.log_item_activity();

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.places enable row level security;
alter table public.items enable row level security;
alter table public.shopping_items enable row level security;
alter table public.events enable row level security;
alter table public.routines enable row level security;
alter table public.notes enable row level security;
alter table public.item_history enable row level security;
alter table public.user_preferences enable row level security;
alter table public.daily_summaries enable row level security;
alter table public.activity_log enable row level security;
alter table public.invites enable row level security;
alter table public.notifications enable row level security;
alter table public.device_preferences enable row level security;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles for select using (id=auth.uid());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());

drop policy if exists spaces_select_member on public.spaces;
create policy spaces_select_member on public.spaces for select using(public.is_space_member(id));
drop policy if exists spaces_update_admin on public.spaces;
create policy spaces_update_admin on public.spaces for update using(public.can_manage_space(id)) with check(public.can_manage_space(id));
drop policy if exists spaces_delete_owner on public.spaces;
create policy spaces_delete_owner on public.spaces for delete using(owner_id=auth.uid() and not is_personal);

drop policy if exists members_select_member on public.space_members;
create policy members_select_member on public.space_members for select using(public.is_space_member(space_id));
drop policy if exists members_insert_admin on public.space_members;
create policy members_insert_admin on public.space_members for insert with check(public.can_manage_space(space_id));
drop policy if exists members_update_admin on public.space_members;
create policy members_update_admin on public.space_members for update using(public.can_manage_space(space_id)) with check(public.can_manage_space(space_id));
drop policy if exists members_delete_admin_or_self on public.space_members;
create policy members_delete_admin_or_self on public.space_members for delete using(user_id=auth.uid() or public.can_manage_space(space_id));

drop policy if exists places_owner_all on public.places;
create policy places_owner_all on public.places for all using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists items_select_access on public.items;
create policy items_select_access on public.items for select using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
drop policy if exists items_insert_access on public.items;
create policy items_insert_access on public.items for insert with check(user_id=auth.uid() and (space_id is null or public.is_space_member(space_id)) and (assigned_to is null or space_id is not null));
drop policy if exists items_update_access on public.items;
create policy items_update_access on public.items for update using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id))) with check(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
drop policy if exists items_delete_access on public.items;
create policy items_delete_access on public.items for delete using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));

drop policy if exists shopping_select_access on public.shopping_items;
create policy shopping_select_access on public.shopping_items for select using(exists(select 1 from public.items i where i.id=item_id and (i.user_id=auth.uid() or public.is_space_member(i.space_id))));
drop policy if exists shopping_write_access on public.shopping_items;
create policy shopping_write_access on public.shopping_items for all using(exists(select 1 from public.items i where i.id=item_id and (i.user_id=auth.uid() or public.is_space_member(i.space_id)))) with check(exists(select 1 from public.items i where i.id=item_id and (i.user_id=auth.uid() or public.is_space_member(i.space_id))));

drop policy if exists events_select_access on public.events;
create policy events_select_access on public.events for select using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
drop policy if exists events_insert_access on public.events;
create policy events_insert_access on public.events for insert with check(user_id=auth.uid() and (space_id is null or public.is_space_member(space_id)));
drop policy if exists events_update_access on public.events;
create policy events_update_access on public.events for update using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id))) with check(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
drop policy if exists events_delete_access on public.events;
create policy events_delete_access on public.events for delete using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));

drop policy if exists routines_select_access on public.routines;
create policy routines_select_access on public.routines for select using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
drop policy if exists routines_insert_access on public.routines;
create policy routines_insert_access on public.routines for insert with check(user_id=auth.uid() and (space_id is null or public.is_space_member(space_id)));
drop policy if exists routines_update_access on public.routines;
create policy routines_update_access on public.routines for update using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id))) with check(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
drop policy if exists routines_delete_access on public.routines;
create policy routines_delete_access on public.routines for delete using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));

drop policy if exists notes_select_access on public.notes;
create policy notes_select_access on public.notes for select using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
drop policy if exists notes_insert_access on public.notes;
create policy notes_insert_access on public.notes for insert with check(user_id=auth.uid() and (space_id is null or public.is_space_member(space_id)));
drop policy if exists notes_update_access on public.notes;
create policy notes_update_access on public.notes for update using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id))) with check(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
drop policy if exists notes_delete_access on public.notes;
create policy notes_delete_access on public.notes for delete using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));

drop policy if exists history_select_access on public.item_history;
create policy history_select_access on public.item_history for select using(exists(select 1 from public.items i where i.id=item_id and (i.user_id=auth.uid() or public.is_space_member(i.space_id))));
drop policy if exists preferences_self on public.user_preferences;
create policy preferences_self on public.user_preferences for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists summaries_self on public.daily_summaries;
create policy summaries_self on public.daily_summaries for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists activity_select_access on public.activity_log;
create policy activity_select_access on public.activity_log for select using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
drop policy if exists invites_select_admin on public.invites;
create policy invites_select_admin on public.invites for select using(public.can_manage_space(space_id));
drop policy if exists invites_delete_admin on public.invites;
create policy invites_delete_admin on public.invites for delete using(public.can_manage_space(space_id));
drop policy if exists notifications_self on public.notifications;
create policy notifications_self on public.notifications for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists devices_self on public.device_preferences;
create policy devices_self on public.device_preferences for all using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Enable only the shared/live tables needed by the client.
do $$ begin
  alter publication supabase_realtime add table public.items;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.shopping_items;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.activity_log;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.space_members;
exception when duplicate_object then null; end $$;

-- ===== ORGANIZER EXPANSION (002) =====
-- JustGlance Organizer Expansion v2.0
-- Safe to run after 001_initial_schema.sql.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  status text not null default 'active' check (status in ('active','paused','completed','archived')),
  priority public.item_priority not null default 'normal',
  icon text not null default 'folder',
  color text,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  archived_at timestamptz
);

alter table public.items add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.items add column if not exists parent_item_id uuid references public.items(id) on delete cascade;
alter table public.items add column if not exists start_date date;
alter table public.items add column if not exists scheduled_at timestamptz;
alter table public.items add column if not exists defer_until timestamptz;
alter table public.items add column if not exists energy_level text check (energy_level is null or energy_level in ('low','medium','high'));
alter table public.items add column if not exists waiting_for text;
alter table public.items add column if not exists is_inbox boolean not null default false;
alter table public.items add column if not exists focus_pin boolean not null default false;
alter table public.items add column if not exists sort_order numeric(12,3) not null default 0;

alter table public.events add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.notes add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.notes add column if not exists pinned boolean not null default false;
alter table public.notes add column if not exists color text;
alter table public.notes add column if not exists source_text text;

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid references public.items(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  body text,
  remind_at timestamptz not null,
  kind text not null default 'notification' check (kind in ('notification','alarm')),
  delivered_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists projects_user_status_idx on public.projects(user_id,status,updated_at desc);
create index if not exists projects_space_status_idx on public.projects(space_id,status) where space_id is not null;
create index if not exists items_project_status_idx on public.items(project_id,status) where deleted_at is null and project_id is not null;
create index if not exists items_inbox_idx on public.items(user_id,is_inbox,status) where deleted_at is null;
create index if not exists items_defer_idx on public.items(user_id,defer_until) where deleted_at is null and defer_until is not null;
create index if not exists events_project_date_idx on public.events(project_id,event_date) where deleted_at is null and project_id is not null;
create index if not exists notes_project_idx on public.notes(project_id,created_at desc) where deleted_at is null and project_id is not null;
create index if not exists reminders_user_time_idx on public.reminders(user_id,remind_at) where dismissed_at is null;

alter table public.projects enable row level security;
alter table public.reminders enable row level security;

drop policy if exists projects_select_access on public.projects;
create policy projects_select_access on public.projects for select
using (user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));

drop policy if exists projects_insert_access on public.projects;
create policy projects_insert_access on public.projects for insert
with check (user_id=auth.uid() and (space_id is null or public.is_space_member(space_id)));

drop policy if exists projects_update_access on public.projects;
create policy projects_update_access on public.projects for update
using (user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)))
with check (user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));

drop policy if exists projects_delete_access on public.projects;
create policy projects_delete_access on public.projects for delete
using (user_id=auth.uid() or (space_id is not null and public.can_manage_space(space_id)));

drop policy if exists reminders_self on public.reminders;
create policy reminders_self on public.reminders for all
using (user_id=auth.uid()) with check (user_id=auth.uid());

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();

-- Existing policies on items/events/notes already gate access by owner or shared-space membership.
-- The new project foreign keys therefore inherit the same access boundary.

do $$ begin
  alter publication supabase_realtime add table public.projects;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.reminders;
exception when duplicate_object then null; end $$;


-- ===== SHARED SPACES / SMART INTAKE (003, crypto-fixed) =====
-- JustGlance v2.1.0 — Shared Spaces + Smart Intake
-- ADDITIVE / MIGRATION-SAFE. Run after 001_initial_schema.sql and 002_organizer_expansion.sql.
-- Existing rows remain valid; existing shared members keep full category access by default.

create or replace function public.default_space_permissions()
returns jsonb language sql immutable as $$
  select '{
    "view_shopping": true, "edit_shopping": true,
    "view_tasks": true, "edit_tasks": true,
    "view_calendar": true, "edit_calendar": true,
    "view_notes": true, "edit_notes": true,
    "view_projects": true, "edit_projects": true,
    "invite_members": false
  }'::jsonb
$$;

alter table public.space_members
  add column if not exists permissions jsonb not null default public.default_space_permissions();

alter table public.invites
  add column if not exists permissions jsonb not null default public.default_space_permissions();

update public.space_members
set permissions = public.default_space_permissions() || coalesce(permissions, '{}'::jsonb)
where permissions is null or permissions = '{}'::jsonb;

update public.invites
set permissions = public.default_space_permissions() || coalesce(permissions, '{}'::jsonb)
where permissions is null or permissions = '{}'::jsonb;

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  icon text not null default 'basket',
  sort_order numeric(12,3) not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shopping_items
  add column if not exists list_id uuid references public.shopping_lists(id) on delete set null;

create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  kind text not null check (kind in ('thought','text','link','file','image','calendar_import')),
  title text not null check (char_length(title) between 1 and 500),
  raw_text text,
  source_url text,
  mime_type text,
  file_name text,
  storage_path text,
  parsed_kind text,
  parsed_data jsonb not null default '{}'::jsonb,
  status text not null default 'inbox' check (status in ('inbox','processed','archived')),
  created_item_id uuid references public.items(id) on delete set null,
  created_event_id uuid references public.events(id) on delete set null,
  created_note_id uuid references public.notes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'ics',
  source_name text,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists shopping_lists_space_idx on public.shopping_lists(space_id, archived_at, sort_order, created_at);
create index if not exists shopping_items_list_idx on public.shopping_items(list_id) where list_id is not null;
create index if not exists captures_user_status_idx on public.captures(user_id,status,created_at desc);
create index if not exists captures_space_status_idx on public.captures(space_id,status,created_at desc) where space_id is not null;
create index if not exists calendar_imports_user_idx on public.calendar_imports(user_id,created_at desc);
create unique index if not exists events_external_provider_unique
  on public.events(user_id,provider,external_id)
  where external_id is not null and deleted_at is null;

create or replace function public.space_permission(p_space uuid, p_permission text)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare member_role public.space_role; member_permissions jsonb; fallback boolean;
begin
  if auth.uid() is null or p_space is null then return false; end if;
  select role, permissions into member_role, member_permissions
  from public.space_members
  where space_id=p_space and user_id=auth.uid();
  if not found then return false; end if;
  if member_role in ('owner','admin') then return true; end if;
  fallback := case when p_permission='invite_members' then false else true end;
  return coalesce((member_permissions->>p_permission)::boolean, fallback);
end $$;
revoke all on function public.space_permission(uuid,text) from public;
grant execute on function public.space_permission(uuid,text) to authenticated;

create or replace function public.get_accessible_space_members_v2()
returns table(space_id uuid, user_id uuid, role public.space_role, permissions jsonb, display_name text, greeting_name text, avatar_url text)
language sql stable security definer set search_path=public as $$
  select m.space_id, m.user_id, m.role, m.permissions, p.display_name, p.greeting_name, p.avatar_url
  from public.space_members m
  join public.profiles p on p.id=m.user_id
  where public.is_space_member(m.space_id)
$$;
revoke all on function public.get_accessible_space_members_v2() from public;
grant execute on function public.get_accessible_space_members_v2() to authenticated;

create or replace function public.get_space_members_v2(p_space uuid)
returns table(user_id uuid, display_name text, greeting_name text, avatar_url text, role public.space_role, permissions jsonb)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_space_member(p_space) then raise exception 'Not allowed'; end if;
  return query
    select m.user_id,p.display_name,p.greeting_name,p.avatar_url,m.role,m.permissions
    from public.space_members m
    join public.profiles p on p.id=m.user_id
    where m.space_id=p_space
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,p.display_name;
end $$;
revoke all on function public.get_space_members_v2(uuid) from public;
grant execute on function public.get_space_members_v2(uuid) to authenticated;

create or replace function public.create_space_invite_v2(
  p_space uuid,
  p_email text default null,
  p_role text default 'member',
  p_permissions jsonb default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare raw_token text; hashed text; expiry timestamptz; role_value public.space_role; perms jsonb; permission_key text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.can_manage_space(p_space) and not public.space_permission(p_space,'invite_members') then
    raise exception 'You do not have permission to invite members to this space';
  end if;
  if exists(select 1 from public.spaces where id=p_space and is_personal) then raise exception 'Personal spaces cannot be shared'; end if;
  if p_role not in ('member','admin') then raise exception 'Invalid invite role'; end if;
  if not public.can_manage_space(p_space) and p_role <> 'member' then raise exception 'Only owners or admins can invite an admin'; end if;
  role_value := p_role::public.space_role;
  perms := public.default_space_permissions() || coalesce(p_permissions,'{}'::jsonb);
  -- Delegated inviters may never grant a permission they do not hold themselves.
  if not public.can_manage_space(p_space) then
    foreach permission_key in array array['view_shopping','edit_shopping','view_tasks','edit_tasks','view_calendar','edit_calendar','view_notes','edit_notes','view_projects','edit_projects','invite_members'] loop
      if coalesce((perms->>permission_key)::boolean,false) and not public.space_permission(p_space,permission_key) then
        raise exception 'Cannot grant permission you do not have: %', permission_key;
      end if;
    end loop;
  end if;
  raw_token := encode(extensions.gen_random_bytes(32),'hex');
  hashed := encode(extensions.digest(convert_to(raw_token,'UTF8'),'sha256'::text),'hex');
  expiry := now() + interval '7 days';
  insert into public.invites(space_id,created_by,invite_email,role,permissions,token_hash,expires_at)
  values(p_space,auth.uid(),lower(nullif(trim(p_email),'')),role_value,perms,hashed,expiry);
  return jsonb_build_object('token',raw_token,'space_id',p_space,'expires_at',expiry);
end $$;
revoke all on function public.create_space_invite_v2(uuid,text,text,jsonb) from public;
grant execute on function public.create_space_invite_v2(uuid,text,text,jsonb) to authenticated;

create or replace function public.consume_space_invite_v2(p_token text)
returns uuid language plpgsql security definer set search_path=public as $$
declare inv public.invites%rowtype; hashed text; current_email text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  hashed := encode(extensions.digest(convert_to(trim(p_token),'UTF8'),'sha256'::text),'hex');
  select * into inv from public.invites where token_hash=hashed and accepted_at is null and expires_at>now() for update;
  if not found then raise exception 'Invite is invalid or expired'; end if;
  select lower(email) into current_email from public.profiles where id=auth.uid();
  if inv.invite_email is not null and lower(inv.invite_email) <> current_email then raise exception 'Invite belongs to another email'; end if;
  if exists(select 1 from public.spaces where id=inv.space_id and is_personal) then raise exception 'Personal spaces cannot be shared'; end if;
  insert into public.space_members(space_id,user_id,role,permissions)
  values(inv.space_id,auth.uid(),inv.role,public.default_space_permissions() || coalesce(inv.permissions,'{}'::jsonb))
  on conflict(space_id,user_id) do update set role=excluded.role, permissions=excluded.permissions;
  update public.invites set accepted_by=auth.uid(),accepted_at=now() where id=inv.id;
  return inv.space_id;
end $$;
revoke all on function public.consume_space_invite_v2(text) from public;
grant execute on function public.consume_space_invite_v2(text) to authenticated;

create or replace function public.update_space_member_access(
  p_space uuid,
  p_user uuid,
  p_permissions jsonb,
  p_role text default null
)
returns void language plpgsql security definer set search_path=public as $$
declare current_role public.space_role; new_role public.space_role;
begin
  if not public.can_manage_space(p_space) then raise exception 'Not allowed'; end if;
  select role into current_role from public.space_members where space_id=p_space and user_id=p_user;
  if not found then raise exception 'Member not found'; end if;
  if current_role='owner' then raise exception 'Owner access cannot be changed here'; end if;
  new_role := current_role;
  if p_role is not null then
    if p_role not in ('member','admin') then raise exception 'Invalid role'; end if;
    if not exists(select 1 from public.space_members where space_id=p_space and user_id=auth.uid() and role='owner') and p_role='admin' then
      raise exception 'Only the owner can promote an admin';
    end if;
    new_role := p_role::public.space_role;
  end if;
  update public.space_members
  set role=new_role, permissions=public.default_space_permissions() || coalesce(p_permissions,'{}'::jsonb)
  where space_id=p_space and user_id=p_user;
end $$;
revoke all on function public.update_space_member_access(uuid,uuid,jsonb,text) from public;
grant execute on function public.update_space_member_access(uuid,uuid,jsonb,text) to authenticated;

create or replace function public.can_access_capture_object(p_name text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.captures c
    where c.storage_path=p_name
      and (c.user_id=auth.uid() or (c.space_id is not null and public.space_permission(c.space_id,'view_notes')))
  )
$$;
revoke all on function public.can_access_capture_object(text) from public;
grant execute on function public.can_access_capture_object(text) to authenticated;

alter table public.shopping_lists enable row level security;
alter table public.captures enable row level security;
alter table public.calendar_imports enable row level security;

drop policy if exists shopping_lists_select_access on public.shopping_lists;
create policy shopping_lists_select_access on public.shopping_lists for select
using(public.space_permission(space_id,'view_shopping'));
drop policy if exists shopping_lists_insert_access on public.shopping_lists;
create policy shopping_lists_insert_access on public.shopping_lists for insert
with check(created_by=auth.uid() and public.space_permission(space_id,'edit_shopping'));
drop policy if exists shopping_lists_update_access on public.shopping_lists;
create policy shopping_lists_update_access on public.shopping_lists for update
using(public.space_permission(space_id,'edit_shopping')) with check(public.space_permission(space_id,'edit_shopping'));
drop policy if exists shopping_lists_delete_access on public.shopping_lists;
create policy shopping_lists_delete_access on public.shopping_lists for delete
using(public.space_permission(space_id,'edit_shopping'));

drop policy if exists captures_select_access on public.captures;
create policy captures_select_access on public.captures for select
using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'view_notes')));
drop policy if exists captures_insert_access on public.captures;
create policy captures_insert_access on public.captures for insert
with check(user_id=auth.uid() and (space_id is null or public.space_permission(space_id,'edit_notes')));
drop policy if exists captures_update_access on public.captures;
create policy captures_update_access on public.captures for update
using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_notes')))
with check((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_notes')));
drop policy if exists captures_delete_access on public.captures;
create policy captures_delete_access on public.captures for delete
using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_notes')));

drop policy if exists calendar_imports_self on public.calendar_imports;
create policy calendar_imports_self on public.calendar_imports for all using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Tighten shared-space category visibility while preserving personal data access.
drop policy if exists items_select_access on public.items;
create policy items_select_access on public.items for select using(
  (space_id is null and user_id=auth.uid()) or
  (space_id is not null and public.space_permission(space_id, case when type='shopping' then 'view_shopping' else 'view_tasks' end))
);
drop policy if exists items_insert_access on public.items;
create policy items_insert_access on public.items for insert with check(
  user_id=auth.uid() and (space_id is null or public.space_permission(space_id, case when type='shopping' then 'edit_shopping' else 'edit_tasks' end))
  and (assigned_to is null or space_id is not null)
);
drop policy if exists items_update_access on public.items;
create policy items_update_access on public.items for update using(
  (space_id is null and user_id=auth.uid()) or
  (space_id is not null and public.space_permission(space_id, case when type='shopping' then 'edit_shopping' else 'edit_tasks' end))
) with check(
  (space_id is null and user_id=auth.uid()) or
  (space_id is not null and public.space_permission(space_id, case when type='shopping' then 'edit_shopping' else 'edit_tasks' end))
);
drop policy if exists items_delete_access on public.items;
create policy items_delete_access on public.items for delete using(
  (space_id is null and user_id=auth.uid()) or
  (space_id is not null and public.space_permission(space_id, case when type='shopping' then 'edit_shopping' else 'edit_tasks' end))
);

drop policy if exists shopping_select_access on public.shopping_items;
create policy shopping_select_access on public.shopping_items for select using(exists(
  select 1 from public.items i where i.id=item_id and ((i.space_id is null and i.user_id=auth.uid()) or (i.space_id is not null and public.space_permission(i.space_id,'view_shopping')))
));
drop policy if exists shopping_write_access on public.shopping_items;
create policy shopping_write_access on public.shopping_items for all using(exists(
  select 1 from public.items i where i.id=item_id and ((i.space_id is null and i.user_id=auth.uid()) or (i.space_id is not null and public.space_permission(i.space_id,'edit_shopping')))
)) with check(exists(
  select 1 from public.items i where i.id=item_id and ((i.space_id is null and i.user_id=auth.uid()) or (i.space_id is not null and public.space_permission(i.space_id,'edit_shopping')))
));

drop policy if exists events_select_access on public.events;
create policy events_select_access on public.events for select using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'view_calendar')));
drop policy if exists events_insert_access on public.events;
create policy events_insert_access on public.events for insert with check(user_id=auth.uid() and (space_id is null or public.space_permission(space_id,'edit_calendar')));
drop policy if exists events_update_access on public.events;
create policy events_update_access on public.events for update using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_calendar'))) with check((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_calendar')));
drop policy if exists events_delete_access on public.events;
create policy events_delete_access on public.events for delete using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_calendar')));

drop policy if exists notes_select_access on public.notes;
create policy notes_select_access on public.notes for select using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'view_notes')));
drop policy if exists notes_insert_access on public.notes;
create policy notes_insert_access on public.notes for insert with check(user_id=auth.uid() and (space_id is null or public.space_permission(space_id,'edit_notes')));
drop policy if exists notes_update_access on public.notes;
create policy notes_update_access on public.notes for update using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_notes'))) with check((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_notes')));
drop policy if exists notes_delete_access on public.notes;
create policy notes_delete_access on public.notes for delete using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_notes')));

drop policy if exists projects_select_access on public.projects;
create policy projects_select_access on public.projects for select using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'view_projects')));
drop policy if exists projects_insert_access on public.projects;
create policy projects_insert_access on public.projects for insert with check(user_id=auth.uid() and (space_id is null or public.space_permission(space_id,'edit_projects')));
drop policy if exists projects_update_access on public.projects;
create policy projects_update_access on public.projects for update using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_projects'))) with check((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_projects')));
drop policy if exists projects_delete_access on public.projects;
create policy projects_delete_access on public.projects for delete using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_projects')));

-- Storage for files/images captured by the user. Private by default.
insert into storage.buckets(id,name,public,file_size_limit)
values('justglance-captures','justglance-captures',false,15728640)
on conflict(id) do update set public=false, file_size_limit=15728640;

drop policy if exists justglance_captures_insert on storage.objects;
create policy justglance_captures_insert on storage.objects for insert to authenticated
with check(bucket_id='justglance-captures' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists justglance_captures_select on storage.objects;
create policy justglance_captures_select on storage.objects for select to authenticated
using(bucket_id='justglance-captures' and ((storage.foldername(name))[1]=auth.uid()::text or public.can_access_capture_object(name)));
drop policy if exists justglance_captures_update on storage.objects;
create policy justglance_captures_update on storage.objects for update to authenticated
using(bucket_id='justglance-captures' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='justglance-captures' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists justglance_captures_delete on storage.objects;
create policy justglance_captures_delete on storage.objects for delete to authenticated
using(bucket_id='justglance-captures' and (storage.foldername(name))[1]=auth.uid()::text);

drop trigger if exists shopping_lists_updated_at on public.shopping_lists;
create trigger shopping_lists_updated_at before update on public.shopping_lists for each row execute function public.set_updated_at();
drop trigger if exists captures_updated_at on public.captures;
create trigger captures_updated_at before update on public.captures for each row execute function public.set_updated_at();
drop trigger if exists captures_creator_guard on public.captures;
create trigger captures_creator_guard before update on public.captures for each row execute function public.protect_creator_identity();

do $$ begin alter publication supabase_realtime add table public.shopping_lists; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.captures; exception when duplicate_object then null; end $$;


-- ===== INVITE RPC NORMALIZATION =====
-- JustGlance v2.1.3 - Invite RPC Hard Reset
-- Migration-safe: does NOT drop or truncate user tables/data.
-- Purpose: repair PostgREST/Supabase RPC discovery for create_space_invite_v2
-- and its legacy fallback, while preserving existing spaces/members/invites.

begin;

-- Supabase normally keeps pgcrypto in extensions. This is idempotent.
-- pgcrypto normalized by master prelude

-- Core role type, only if an older/partial schema never created it.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='space_role'
  ) then
    create type public.space_role as enum ('owner','admin','member');
  end if;
end $$;

-- Repair profile rows required by FK-backed collaboration tables.
insert into public.profiles(id,email,display_name,greeting_name)
select
  u.id,
  u.email,
  coalesce(nullif(u.raw_user_meta_data->>'full_name',''), nullif(split_part(coalesce(u.email,''),'@',1),''), 'User'),
  coalesce(nullif(u.raw_user_meta_data->>'full_name',''), nullif(split_part(coalesce(u.email,''),'@',1),''), 'there')
from auth.users u
on conflict(id) do update
set email = coalesce(excluded.email, public.profiles.email);

-- Make sure the invite columns expected by v2.1 exist.
alter table public.space_members
  add column if not exists permissions jsonb;

alter table public.invites add column if not exists invite_email text;
alter table public.invites add column if not exists token_hash text;
alter table public.invites add column if not exists expires_at timestamptz;
alter table public.invites add column if not exists accepted_by uuid references public.profiles(id) on delete set null;
alter table public.invites add column if not exists accepted_at timestamptz;
alter table public.invites add column if not exists permissions jsonb;
alter table public.invites add column if not exists created_at timestamptz default now();

-- Canonical permission set.
create or replace function public.default_space_permissions()
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select '{
    "view_shopping": true,
    "edit_shopping": true,
    "view_tasks": true,
    "edit_tasks": true,
    "view_calendar": true,
    "edit_calendar": true,
    "view_notes": true,
    "edit_notes": true,
    "view_projects": true,
    "edit_projects": true,
    "invite_members": false
  }'::jsonb
$$;

alter table public.space_members
  alter column permissions set default public.default_space_permissions();
update public.space_members
set permissions = public.default_space_permissions() || coalesce(permissions,'{}'::jsonb)
where permissions is null or permissions='{}'::jsonb;
alter table public.space_members alter column permissions set not null;

alter table public.invites
  alter column permissions set default public.default_space_permissions();
update public.invites
set permissions = public.default_space_permissions() || coalesce(permissions,'{}'::jsonb)
where permissions is null or permissions='{}'::jsonb;
alter table public.invites alter column permissions set not null;

update public.invites
set expires_at = coalesce(expires_at, now() + interval '7 days')
where expires_at is null;
alter table public.invites
  alter column expires_at set default (now() + interval '7 days');
alter table public.invites alter column expires_at set not null;

-- Every space owner must also have an owner membership row.
insert into public.space_members(space_id,user_id,role,permissions)
select s.id,s.owner_id,'owner'::public.space_role,public.default_space_permissions()
from public.spaces s
where s.owner_id is not null
on conflict(space_id,user_id) do update
set role='owner'::public.space_role,
    permissions=public.default_space_permissions() || coalesce(public.space_members.permissions,'{}'::jsonb);

-- Self-contained permission helpers used by the RPC.
create or replace function public.can_manage_space(p_space uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1
    from public.spaces s
    where s.id=p_space and s.owner_id=auth.uid()
  ) or exists(
    select 1
    from public.space_members m
    where m.space_id=p_space
      and m.user_id=auth.uid()
      and m.role in ('owner'::public.space_role,'admin'::public.space_role)
  )
$$;

create or replace function public.space_permission(p_space uuid, p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  member_role public.space_role;
  member_permissions jsonb;
begin
  if auth.uid() is null then return false; end if;

  if exists(select 1 from public.spaces s where s.id=p_space and s.owner_id=auth.uid()) then
    return true;
  end if;

  select m.role,m.permissions
  into member_role,member_permissions
  from public.space_members m
  where m.space_id=p_space and m.user_id=auth.uid();

  if not found then return false; end if;
  if member_role in ('owner'::public.space_role,'admin'::public.space_role) then return true; end if;

  return coalesce(
    (member_permissions->>p_permission)::boolean,
    case when p_permission='invite_members' then false else true end
  );
end $$;

-- Remove EVERY overload of the two creation RPC names. A stale overload with
-- different parameter names/types can cause PGRST202 / HTTP 404 even when a
-- function with the same visible name exists.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in ('create_space_invite_v2','create_space_invite')
  loop
    execute 'drop function ' || r.signature;
  end loop;
end $$;

-- Exact RPC signature used by Supabase JS in JustGlance v2.1.x.
create function public.create_space_invite_v2(
  p_space uuid,
  p_email text default null,
  p_role text default 'member',
  p_permissions jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  raw_token text;
  hashed text;
  expiry timestamptz;
  clean_email text;
  perms jsonb;
  requested_role public.space_role;
  permission_key text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode='28000';
  end if;

  if not exists(select 1 from public.spaces s where s.id=p_space) then
    raise exception 'Space not found';
  end if;

  if exists(select 1 from public.spaces s where s.id=p_space and coalesce(s.is_personal,false)) then
    raise exception 'Personal spaces cannot be shared';
  end if;

  if not public.can_manage_space(p_space)
     and not public.space_permission(p_space,'invite_members') then
    raise exception 'You do not have permission to invite members to this space';
  end if;

  if coalesce(p_role,'member') not in ('member','admin') then
    raise exception 'Invalid invite role';
  end if;

  if not public.can_manage_space(p_space) and coalesce(p_role,'member') <> 'member' then
    raise exception 'Only owners or admins can invite an admin';
  end if;

  requested_role := coalesce(p_role,'member')::public.space_role;
  clean_email := lower(nullif(trim(coalesce(p_email,'')),''));
  perms := public.default_space_permissions() || coalesce(p_permissions,'{}'::jsonb);

  if not public.can_manage_space(p_space) then
    foreach permission_key in array array[
      'view_shopping','edit_shopping','view_tasks','edit_tasks',
      'view_calendar','edit_calendar','view_notes','edit_notes',
      'view_projects','edit_projects','invite_members'
    ] loop
      if coalesce((perms->>permission_key)::boolean,false)
         and not public.space_permission(p_space,permission_key) then
        raise exception 'Cannot grant permission you do not have: %', permission_key;
      end if;
    end loop;
  end if;

  raw_token := encode(extensions.gen_random_bytes(32),'hex');
  hashed := encode(extensions.digest(convert_to(raw_token,'UTF8'),'sha256'::text),'hex');
  expiry := now() + interval '7 days';

  insert into public.invites(
    space_id,created_by,invite_email,role,permissions,token_hash,expires_at
  )
  values(
    p_space,auth.uid(),clean_email,requested_role,perms,hashed,expiry
  );

  return jsonb_build_object(
    'token', raw_token,
    'space_id', p_space,
    'expires_at', expiry,
    'role', requested_role::text,
    'email', clean_email
  );
end $$;

-- Legacy fallback kept intentionally, but with one unambiguous TEXT signature.
create function public.create_space_invite(
  p_space uuid,
  p_email text default null,
  p_role text default 'member'
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare result jsonb;
begin
  result := public.create_space_invite_v2(
    p_space,
    p_email,
    coalesce(p_role,'member'),
    public.default_space_permissions()
  );
  return result->>'token';
end $$;

-- Supabase/PostgREST privileges. Granting anon EXECUTE is safe here because
-- the function itself refuses auth.uid() IS NULL. It also makes an expired or
-- missing login return a useful auth error instead of masquerading as RPC 404.
grant usage on schema public to anon, authenticated;
revoke all on function public.create_space_invite_v2(uuid,text,text,jsonb) from public;
revoke all on function public.create_space_invite(uuid,text,text) from public;
grant execute on function public.create_space_invite_v2(uuid,text,text,jsonb) to anon, authenticated;
grant execute on function public.create_space_invite(uuid,text,text) to anon, authenticated;
grant execute on function public.can_manage_space(uuid) to authenticated;
grant execute on function public.space_permission(uuid,text) to authenticated;
grant execute on function public.default_space_permissions() to authenticated;

commit;

-- Explicitly force PostgREST to re-introspect routines.
select pg_notify('pgrst','reload schema');

-- IMPORTANT: this is deliberately the LAST result set. Send a screenshot of
-- THIS row if the browser still reports 404. Both RPC names must be non-null,
-- overload counts must be 1, and authenticated_execute must be true.
select
  to_regprocedure('public.create_space_invite_v2(uuid,text,text,jsonb)')::text as modern_rpc,
  (
    select count(*)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='create_space_invite_v2'
  ) as modern_overload_count,
  has_function_privilege(
    'authenticated',
    to_regprocedure('public.create_space_invite_v2(uuid,text,text,jsonb)'),
    'EXECUTE'
  ) as modern_authenticated_execute,
  has_function_privilege(
    'anon',
    to_regprocedure('public.create_space_invite_v2(uuid,text,text,jsonb)'),
    'EXECUTE'
  ) as modern_anon_execute,
  to_regprocedure('public.create_space_invite(uuid,text,text)')::text as legacy_rpc,
  (
    select count(*)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='create_space_invite'
  ) as legacy_overload_count,
  has_function_privilege(
    'authenticated',
    to_regprocedure('public.create_space_invite(uuid,text,text)'),
    'EXECUTE'
  ) as legacy_authenticated_execute,
  (
    select count(*)
    from public.spaces s
    where s.owner_id is not null
      and not exists(
        select 1 from public.space_members m
        where m.space_id=s.id and m.user_id=s.owner_id and m.role='owner'::public.space_role
      )
  ) as missing_owner_memberships;


-- ===== SMART SHOPPING / BROWSER BRIDGE (004, crypto-fixed) =====
-- JustGlance v2.3.1 — FIXED Smart shopping links + browser extension bridge
-- Additive / migration-safe. Does not delete existing items, lists, members, invites, or captures.

-- pgcrypto normalized by master prelude


-- Rich product metadata. The base public.items row remains canonical.
alter table if exists public.shopping_items
  add column if not exists source_url text,
  add column if not exists image_url text,
  add column if not exists currency text,
  add column if not exists product_id text,
  add column if not exists product_metadata jsonb not null default '{}'::jsonb;

create index if not exists shopping_items_source_url_idx
  on public.shopping_items(source_url)
  where source_url is not null;

-- Revocable, shopping-only browser integration credentials.
-- Only a SHA-256 hash is stored. The raw token is returned once when created.
create table if not exists public.browser_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Chrome',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists browser_integrations_user_idx
  on public.browser_integrations(user_id, revoked_at, created_at desc);

alter table public.browser_integrations enable row level security;

drop policy if exists browser_integrations_select_self on public.browser_integrations;
create policy browser_integrations_select_self
  on public.browser_integrations for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists browser_integrations_insert_self on public.browser_integrations;
create policy browser_integrations_insert_self
  on public.browser_integrations for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists browser_integrations_update_self on public.browser_integrations;
create policy browser_integrations_update_self
  on public.browser_integrations for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists browser_integrations_delete_self on public.browser_integrations;
create policy browser_integrations_delete_self
  on public.browser_integrations for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.browser_integrations to authenticated;

-- Create a revocable browser token. This token is NOT a Supabase access token and
-- can only be used with the narrowly-scoped browser RPCs below.
create or replace function public.create_browser_integration(p_name text default 'Chrome')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_token text;
  hashed text;
  integration_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  raw_token := 'jgext_' || encode(extensions.gen_random_bytes(32), 'hex');
  hashed := encode(extensions.digest(convert_to(raw_token, 'UTF8'), 'sha256'::text), 'hex');

  insert into public.browser_integrations(user_id, name, token_hash)
  values(auth.uid(), coalesce(nullif(trim(p_name), ''), 'Chrome'), hashed)
  returning id into integration_id;

  return jsonb_build_object(
    'id', integration_id,
    'token', raw_token,
    'name', coalesce(nullif(trim(p_name), ''), 'Chrome')
  );
end $$;

revoke all on function public.create_browser_integration(text) from public;
grant execute on function public.create_browser_integration(text) to authenticated;

create or replace function public.revoke_browser_integration(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.browser_integrations
  set revoked_at = now()
  where id = p_id and user_id = auth.uid() and revoked_at is null;
end $$;

revoke all on function public.revoke_browser_integration(uuid) from public;
grant execute on function public.revoke_browser_integration(uuid) to authenticated;

-- Internal helper: resolve a raw browser token to its owner.
create or replace function public.browser_integration_user(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select bi.user_id
  from public.browser_integrations bi
  where bi.token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'::text), 'hex')
    and bi.revoked_at is null
  limit 1
$$;

revoke all on function public.browser_integration_user(text) from public;

-- Internal helper: browser integrations may only write shopping data in spaces
-- where the token owner currently has edit-shopping access.
create or replace function public.browser_can_edit_shopping(p_user uuid, p_space uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.space_members m
    where m.user_id = p_user
      and m.space_id = p_space
      and (
        m.role in ('owner','admin')
        or coalesce((m.permissions ->> 'edit_shopping')::boolean, true)
      )
  )
$$;

revoke all on function public.browser_can_edit_shopping(uuid,uuid) from public;

-- Two-way list sync used by the Chrome extension. Includes a synthetic General
-- destination (list_id = null) for every editable space.
create or replace function public.browser_get_shopping_lists(p_token text)
returns table(
  space_id uuid,
  space_name text,
  list_id uuid,
  list_name text,
  list_icon text,
  sort_order numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  token_user uuid;
begin
  token_user := public.browser_integration_user(p_token);
  if token_user is null then raise exception 'Invalid or revoked JustGlance browser token'; end if;

  update public.browser_integrations
  set last_used_at = now()
  where user_id = token_user
    and token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'::text), 'hex');

  return query
  select s.id, s.name, sl.id, sl.name, sl.icon, sl.sort_order
  from public.spaces s
  join public.space_members m on m.space_id = s.id and m.user_id = token_user
  join public.shopping_lists sl on sl.space_id = s.id and sl.archived_at is null
  where public.browser_can_edit_shopping(token_user, s.id)

  union all

  select s.id, s.name, null::uuid, 'General'::text, 'basket'::text, 999999::numeric
  from public.spaces s
  join public.space_members m on m.space_id = s.id and m.user_id = token_user
  where public.browser_can_edit_shopping(token_user, s.id)

  order by 2, 6, 4;
end $$;

revoke all on function public.browser_get_shopping_lists(text) from public;
grant execute on function public.browser_get_shopping_lists(text) to anon, authenticated;

-- Shopping-only write endpoint for the extension. It cannot create arbitrary
-- notes/tasks/events and it rechecks current space permissions on every write.
create or replace function public.browser_add_shopping_item(
  p_token text,
  p_space uuid,
  p_list uuid default null,
  p_title text default null,
  p_url text default null,
  p_image_url text default null,
  p_price numeric default null,
  p_currency text default 'USD',
  p_store text default null,
  p_category text default null,
  p_product_id text default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  token_user uuid;
  new_item uuid;
  clean_title text;
begin
  token_user := public.browser_integration_user(p_token);
  if token_user is null then raise exception 'Invalid or revoked JustGlance browser token'; end if;
  if not public.browser_can_edit_shopping(token_user, p_space) then raise exception 'Shopping access is no longer available for that space'; end if;

  if p_list is not null and not exists(
    select 1 from public.shopping_lists sl
    where sl.id = p_list and sl.space_id = p_space and sl.archived_at is null
  ) then
    raise exception 'Shopping list does not belong to that space';
  end if;

  clean_title := nullif(trim(coalesce(p_title, '')), '');
  if clean_title is null then clean_title := coalesce(nullif(trim(p_store), ''), 'Saved product'); end if;

  insert into public.items(
    user_id, space_id, title, description, type, status, priority,
    context_tags, source_text, parser_result
  ) values (
    token_user, p_space, left(clean_title, 500), nullif(trim(p_notes), ''),
    'shopping', 'open', 'normal',
    array['product-link','browser-extension'], p_url,
    jsonb_build_object('source','browser-extension','url',p_url,'store',p_store,'category',p_category)
  ) returning id into new_item;

  insert into public.shopping_items(
    item_id, quantity, preferred_store, estimated_price, aisle_category,
    list_id, source_url, image_url, currency, product_id, product_metadata
  ) values (
    new_item, 1, nullif(trim(p_store), ''), p_price, nullif(trim(p_category), ''),
    p_list, nullif(trim(p_url), ''), nullif(trim(p_image_url), ''),
    nullif(upper(trim(coalesce(p_currency, ''))), ''), nullif(trim(p_product_id), ''), coalesce(p_metadata, '{}'::jsonb)
  );

  update public.browser_integrations
  set last_used_at = now()
  where user_id = token_user
    and token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'::text), 'hex');

  return jsonb_build_object('item_id', new_item, 'space_id', p_space, 'list_id', p_list, 'title', clean_title);
end $$;

revoke all on function public.browser_add_shopping_item(text,uuid,uuid,text,text,text,numeric,text,text,text,text,text,jsonb) from public;
grant execute on function public.browser_add_shopping_item(text,uuid,uuid,text,text,text,numeric,text,text,text,text,text,jsonb) to anon, authenticated;

-- Realtime already publishes shopping_items/shopping_lists in migration 003.
-- Force PostgREST to notice new columns/functions immediately.
notify pgrst, 'reload schema';

-- Final diagnostic result.
select
  to_regclass('public.browser_integrations') is not null as browser_integrations_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='shopping_items' and column_name='source_url') as product_links_ready,
  to_regprocedure('public.create_browser_integration(text)') is not null as pairing_rpc_ready,
  to_regprocedure('public.browser_get_shopping_lists(text)') is not null as list_rpc_ready,
  to_regprocedure('public.browser_add_shopping_item(text,uuid,uuid,text,text,text,numeric,text,text,text,text,text,jsonb)') is not null as add_rpc_ready;


-- ===== CONTACTS / UNIVERSAL MEMORY (005) =====
-- JustGlance v2.3.0 — Contacts + Universal Memory / AI Intake
-- ADDITIVE / MIGRATION-SAFE. Safe to run after previous JustGlance migrations.
-- Existing tasks, events, captures, shopping data, spaces, invites and projects are preserved.

-- pgcrypto normalized by master prelude

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



-- Profile upserts require INSERT permission as well as UPDATE permission.
alter table public.profiles enable row level security;
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (id=auth.uid());
grant select, insert, update on public.profiles to authenticated;

notify pgrst, 'reload schema';

-- FINAL DIAGNOSTIC. Every *_ready column should be TRUE and invite overload count should be 1.
select
  to_regclass('public.profiles') is not null as profiles_ready,
  to_regclass('public.spaces') is not null as spaces_ready,
  to_regclass('public.space_members') is not null as members_ready,
  to_regclass('public.items') is not null as items_ready,
  to_regclass('public.events') is not null as events_ready,
  to_regclass('public.shopping_items') is not null as shopping_items_ready,
  to_regclass('public.shopping_lists') is not null as shopping_lists_ready,
  to_regclass('public.captures') is not null as captures_ready,
  to_regclass('public.calendar_imports') is not null as calendar_imports_ready,
  to_regclass('public.browser_integrations') is not null as browser_integrations_ready,
  to_regclass('public.contacts') is not null as contacts_ready,
  to_regprocedure('public.create_space_invite_v2(uuid,text,text,jsonb)') is not null as invite_v2_ready,
  to_regprocedure('public.create_browser_integration(text)') is not null as browser_pairing_ready,
  to_regprocedure('public.browser_get_shopping_lists(text)') is not null as browser_lists_ready,
  to_regprocedure('public.browser_add_shopping_item(text,uuid,uuid,text,text,text,numeric,text,text,text,text,text,jsonb)') is not null as browser_add_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='captures' and column_name='ai_status') as ai_capture_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='items' and column_name='contact_id') as item_contact_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='shopping_items' and column_name='source_url') as product_link_ready,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_space_invite_v2') as invite_v2_overload_count;
