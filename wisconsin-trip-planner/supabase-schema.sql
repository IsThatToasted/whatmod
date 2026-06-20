-- Connection Quest Engine v4 storage-efficient Supabase schema
-- Safe to re-run in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists cq_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists cq_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  partner_id uuid references auth.users(id) on delete set null,
  invite_code text unique default encode(gen_random_bytes(8),'hex'),
  status text default 'open',
  created_at timestamptz default now()
);

create table if not exists cq_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer default 0,
  level integer default 1,
  completed_areas text[] default '{}',
  unlocked_achievements text[] default '{}',
  updated_at timestamptz default now()
);

create table if not exists cq_answers (
  user_id uuid references auth.users(id) on delete cascade,
  connection_id uuid references cq_connections(id) on delete cascade,
  question_id text not null,
  answer_value text not null check (char_length(answer_value) <= 320),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key(user_id, connection_id, question_id)
);

create table if not exists cq_secret_answers (
  user_id uuid references auth.users(id) on delete cascade,
  secret_id text not null,
  answer_value text not null check (char_length(answer_value) <= 280),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key(user_id, secret_id)
);

alter table cq_profiles enable row level security;
alter table cq_connections enable row level security;
alter table cq_progress enable row level security;
alter table cq_answers enable row level security;
alter table cq_secret_answers enable row level security;

-- Supabase/Postgres does not support CREATE POLICY IF NOT EXISTS.
-- Drop/recreate keeps this script safe to run repeatedly.
drop policy if exists "profiles own" on cq_profiles;
create policy "profiles own" on cq_profiles
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "progress own" on cq_progress;
create policy "progress own" on cq_progress
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "secret own" on cq_secret_answers;
create policy "secret own" on cq_secret_answers
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "connection members" on cq_connections;
create policy "connection members" on cq_connections
for all using (auth.uid() = owner_id or auth.uid() = partner_id)
with check (auth.uid() = owner_id or auth.uid() = partner_id or partner_id is null);

drop policy if exists "answers own" on cq_answers;
create policy "answers own" on cq_answers
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists cq_answers_user_idx on cq_answers(user_id);
create index if not exists cq_answers_connection_idx on cq_answers(connection_id);
create index if not exists cq_secret_answers_user_idx on cq_secret_answers(user_id);
create index if not exists cq_connections_invite_idx on cq_connections(invite_code);


-- v4.1 compatibility patch for earlier cq_profiles tables
alter table cq_profiles add column if not exists email text;
