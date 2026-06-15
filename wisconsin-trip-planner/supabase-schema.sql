-- Bedroom Compatibility Builder schema
-- Run this in the Supabase SQL editor for the project used in config.js.

create extension if not exists pgcrypto;

create table if not exists public.bcc_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bcc_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Compatibility Builder',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bcc_session_members (
  session_id uuid not null references public.bcc_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'partner' check (role in ('owner','partner')),
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table if not exists public.bcc_answers (
  session_id uuid not null references public.bcc_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  answer_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id, question_id)
);

-- Direct profile foreign keys make Supabase/PostgREST embedded selects work reliably.
-- Safe to rerun; if old tables already exist, this adds the missing relationships.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bcc_session_members_user_profile_fk'
  ) then
    alter table public.bcc_session_members
    add constraint bcc_session_members_user_profile_fk
    foreign key (user_id) references public.bcc_profiles(user_id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bcc_answers_user_profile_fk'
  ) then
    alter table public.bcc_answers
    add constraint bcc_answers_user_profile_fk
    foreign key (user_id) references public.bcc_profiles(user_id) on delete cascade;
  end if;
end $$;

create or replace function public.bcc_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bcc_profiles_touch on public.bcc_profiles;
create trigger bcc_profiles_touch before update on public.bcc_profiles
for each row execute function public.bcc_touch_updated_at();

drop trigger if exists bcc_sessions_touch on public.bcc_sessions;
create trigger bcc_sessions_touch before update on public.bcc_sessions
for each row execute function public.bcc_touch_updated_at();

drop trigger if exists bcc_answers_touch on public.bcc_answers;
create trigger bcc_answers_touch before update on public.bcc_answers
for each row execute function public.bcc_touch_updated_at();


create or replace function public.bcc_limit_two_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare member_count integer;
begin
  select count(*) into member_count
  from public.bcc_session_members
  where session_id = new.session_id;

  if member_count >= 2 then
    raise exception 'This compatibility builder already has two people.';
  end if;

  return new;
end;
$$;

drop trigger if exists bcc_limit_two_members_trigger on public.bcc_session_members;
create trigger bcc_limit_two_members_trigger
before insert on public.bcc_session_members
for each row execute function public.bcc_limit_two_members();


alter table public.bcc_profiles enable row level security;
alter table public.bcc_sessions enable row level security;
alter table public.bcc_session_members enable row level security;
alter table public.bcc_answers enable row level security;


create or replace function public.bcc_is_session_member(p_session_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bcc_session_members m
    where m.session_id = p_session_id and m.user_id = p_user_id
  );
$$;

create or replace function public.bcc_shares_session_with(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bcc_session_members a
    join public.bcc_session_members b on b.session_id = a.session_id
    where a.user_id = p_user_a and b.user_id = p_user_b
  );
$$;


-- Clean old policies for easy reruns.
drop policy if exists "bcc profiles own select" on public.bcc_profiles;
drop policy if exists "bcc profiles partner select" on public.bcc_profiles;
drop policy if exists "bcc profiles own insert" on public.bcc_profiles;
drop policy if exists "bcc profiles own update" on public.bcc_profiles;
drop policy if exists "bcc sessions member select" on public.bcc_sessions;
drop policy if exists "bcc sessions authenticated invite select" on public.bcc_sessions;
drop policy if exists "bcc sessions owner insert" on public.bcc_sessions;
drop policy if exists "bcc sessions owner update" on public.bcc_sessions;
drop policy if exists "bcc session members select members" on public.bcc_session_members;
drop policy if exists "bcc session members insert self" on public.bcc_session_members;
drop policy if exists "bcc answers member select" on public.bcc_answers;
drop policy if exists "bcc answers own insert" on public.bcc_answers;
drop policy if exists "bcc answers own update" on public.bcc_answers;
drop policy if exists "bcc answers own delete" on public.bcc_answers;

create policy "bcc profiles own select"
on public.bcc_profiles for select to authenticated
using (user_id = auth.uid());

create policy "bcc profiles partner select"
on public.bcc_profiles for select to authenticated
using (
  public.bcc_shares_session_with(auth.uid(), bcc_profiles.user_id)
);

create policy "bcc profiles own insert"
on public.bcc_profiles for insert to authenticated
with check (user_id = auth.uid());

create policy "bcc profiles own update"
on public.bcc_profiles for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "bcc sessions member select"
on public.bcc_sessions for select to authenticated
using (
  owner_id = auth.uid()
  or public.bcc_is_session_member(bcc_sessions.id, auth.uid())
);

-- Lets an authenticated invite recipient open a session by id before they become a member.
create policy "bcc sessions authenticated invite select"
on public.bcc_sessions for select to authenticated
using (true);

create policy "bcc sessions owner insert"
on public.bcc_sessions for insert to authenticated
with check (owner_id = auth.uid());

create policy "bcc sessions owner update"
on public.bcc_sessions for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "bcc session members select members"
on public.bcc_session_members for select to authenticated
using (
  user_id = auth.uid()
  or public.bcc_is_session_member(bcc_session_members.session_id, auth.uid())
);

-- Allows a logged-in invite recipient to add themselves. The app blocks sessions after 2 people.
create policy "bcc session members insert self"
on public.bcc_session_members for insert to authenticated
with check (user_id = auth.uid());

create policy "bcc answers member select"
on public.bcc_answers for select to authenticated
using (
  public.bcc_is_session_member(bcc_answers.session_id, auth.uid())
);

create policy "bcc answers own insert"
on public.bcc_answers for insert to authenticated
with check (
  user_id = auth.uid()
  and public.bcc_is_session_member(bcc_answers.session_id, auth.uid())
);

create policy "bcc answers own update"
on public.bcc_answers for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "bcc answers own delete"
on public.bcc_answers for delete to authenticated
using (user_id = auth.uid());

-- Realtime: needed for live client updates.
do $$
begin
  alter publication supabase_realtime add table public.bcc_session_members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.bcc_answers;
exception when duplicate_object then null;
end $$;
