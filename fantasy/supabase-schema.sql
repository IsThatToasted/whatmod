-- Fantasy Vault schema with Google/Supabase Auth ownership, admin config, and profile photos.
-- Run in Supabase SQL Editor. For an early prototype, this resets the main profile table.

create extension if not exists pgcrypto;

-- User profile data synced by the app.
drop table if exists public.fv_profiles cascade;
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
on public.fv_profiles for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own Fantasy Vault profile"
on public.fv_profiles for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own Fantasy Vault profile"
on public.fv_profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own Fantasy Vault profile"
on public.fv_profiles for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists fv_profiles_user_id_idx on public.fv_profiles(user_id);

-- Admin-editable app/Vault configuration.
create table if not exists public.fv_admin_config (
  key text primary key,
  value jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.fv_admin_config enable row level security;

drop policy if exists "Authenticated users can read Fantasy Vault config" on public.fv_admin_config;
drop policy if exists "Owner can insert Fantasy Vault config" on public.fv_admin_config;
drop policy if exists "Owner can update Fantasy Vault config" on public.fv_admin_config;
drop policy if exists "Owner can delete Fantasy Vault config" on public.fv_admin_config;

create policy "Authenticated users can read Fantasy Vault config"
on public.fv_admin_config for select
to authenticated
using (true);

create policy "Owner can insert Fantasy Vault config"
on public.fv_admin_config for insert
to authenticated
with check ((auth.jwt() ->> 'email') = 'ra1nonit1@gmail.com');

create policy "Owner can update Fantasy Vault config"
on public.fv_admin_config for update
to authenticated
using ((auth.jwt() ->> 'email') = 'ra1nonit1@gmail.com')
with check ((auth.jwt() ->> 'email') = 'ra1nonit1@gmail.com');

create policy "Owner can delete Fantasy Vault config"
on public.fv_admin_config for delete
to authenticated
using ((auth.jwt() ->> 'email') = 'ra1nonit1@gmail.com');

-- Profile photo storage bucket. Public read makes avatar display simple on GitHub Pages.
insert into storage.buckets (id, name, public)
values ('fv-profile-photos', 'fv-profile-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view Fantasy Vault profile photos" on storage.objects;
drop policy if exists "Users can upload own Fantasy Vault profile photos" on storage.objects;
drop policy if exists "Users can update own Fantasy Vault profile photos" on storage.objects;
drop policy if exists "Users can delete own Fantasy Vault profile photos" on storage.objects;

create policy "Public can view Fantasy Vault profile photos"
on storage.objects for select
using (bucket_id = 'fv-profile-photos');

create policy "Users can upload own Fantasy Vault profile photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'fv-profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update own Fantasy Vault profile photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'fv-profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'fv-profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own Fantasy Vault profile photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'fv-profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
