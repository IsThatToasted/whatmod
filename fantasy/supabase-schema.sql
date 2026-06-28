-- Fantasy Vault schema with Supabase Auth ownership
-- Prototype reset version. This drops the old user_key table and recreates user_id only.

drop table if exists public.fv_profiles cascade;

create extension if not exists pgcrypto;

create table public.fv_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  email text,
  profile jsonb not null default '{}'::jsonb,
  ratings jsonb not null default '{}'::jsonb,
  liked jsonb not null default '[]'::jsonb,
  passed jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fv_profiles enable row level security;

create policy "Users can read own Fantasy Vault profile"
on public.fv_profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own Fantasy Vault profile"
on public.fv_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own Fantasy Vault profile"
on public.fv_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own Fantasy Vault profile"
on public.fv_profiles
for delete
to authenticated
using (auth.uid() = user_id);

create index fv_profiles_user_id_idx on public.fv_profiles(user_id);
