-- Fantasy Vault prototype schema with Supabase Auth ownership
-- Run this in Supabase SQL Editor after enabling Google Auth.

create table if not exists public.fv_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  user_key text unique not null,
  email text,
  profile jsonb not null default '{}'::jsonb,
  ratings jsonb not null default '{}'::jsonb,
  liked jsonb not null default '[]'::jsonb,
  passed jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fv_profiles enable row level security;

drop policy if exists "prototype anon access" on public.fv_profiles;
drop policy if exists "Users can read own Fantasy Vault profile" on public.fv_profiles;
drop policy if exists "Users can insert own Fantasy Vault profile" on public.fv_profiles;
drop policy if exists "Users can update own Fantasy Vault profile" on public.fv_profiles;
drop policy if exists "Users can delete own Fantasy Vault profile" on public.fv_profiles;

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

create index if not exists fv_profiles_user_id_idx on public.fv_profiles(user_id);
