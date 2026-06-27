-- Fantasy Vault prototype schema
-- Run this in Supabase SQL Editor. This is a simple prototype table only.
create table if not exists public.fv_profiles (
  id uuid primary key default gen_random_uuid(),
  user_key text unique not null,
  profile jsonb not null default '{}'::jsonb,
  ratings jsonb not null default '{}'::jsonb,
  liked jsonb not null default '[]'::jsonb,
  passed jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fv_profiles enable row level security;

-- Prototype-only policy: allows anonymous browser prototype reads/writes.
-- Tighten this before real launch by using Supabase Auth and user_id ownership policies.
drop policy if exists "prototype anon access" on public.fv_profiles;
create policy "prototype anon access"
on public.fv_profiles
for all
to anon, authenticated
using (true)
with check (true);
