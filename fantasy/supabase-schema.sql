-- Fantasy Vault production-safe schema/migration.
-- Run in Supabase SQL Editor. This version does NOT drop existing user data.

create extension if not exists pgcrypto;

-- Main user profile data synced by the app.
create table if not exists public.fv_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text,
  profile jsonb not null default '{}'::jsonb,
  ratings jsonb not null default '{}'::jsonb,
  liked jsonb not null default '[]'::jsonb,
  passed jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fv_profiles add column if not exists user_id uuid unique references auth.users(id) on delete cascade;
alter table public.fv_profiles add column if not exists email text;
alter table public.fv_profiles add column if not exists profile jsonb not null default '{}'::jsonb;
alter table public.fv_profiles add column if not exists ratings jsonb not null default '{}'::jsonb;
alter table public.fv_profiles add column if not exists liked jsonb not null default '[]'::jsonb;
alter table public.fv_profiles add column if not exists passed jsonb not null default '[]'::jsonb;
alter table public.fv_profiles add column if not exists created_at timestamptz not null default now();
alter table public.fv_profiles add column if not exists updated_at timestamptz not null default now();

alter table public.fv_profiles enable row level security;

drop policy if exists "Users can read own Fantasy Vault profile" on public.fv_profiles;
drop policy if exists "Authenticated users can read Fantasy Vault directory" on public.fv_profiles;
drop policy if exists "Users can insert own Fantasy Vault profile" on public.fv_profiles;
drop policy if exists "Users can update own Fantasy Vault profile" on public.fv_profiles;
drop policy if exists "Users can delete own Fantasy Vault profile" on public.fv_profiles;

-- Needed for Discover/Matches. Keep sensitive data out of profile JSON until a dedicated public profile table is added.
create policy "Authenticated users can read Fantasy Vault directory"
on public.fv_profiles for select
to authenticated
using (true);

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
create index if not exists fv_profiles_updated_at_idx on public.fv_profiles(updated_at desc);

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

-- Lightweight match messaging. Messages are visible only to the sender/recipient
-- and are treated as expired after 72 hours. The app also deletes expired rows
-- during normal use so storage stays small without needing a paid scheduled job.
create table if not exists public.fv_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '72 hours')
);

alter table public.fv_messages add column if not exists conversation_id text;
alter table public.fv_messages add column if not exists sender_id uuid references auth.users(id) on delete cascade;
alter table public.fv_messages add column if not exists recipient_id uuid references auth.users(id) on delete cascade;
alter table public.fv_messages add column if not exists body text;
alter table public.fv_messages add column if not exists created_at timestamptz not null default now();
alter table public.fv_messages add column if not exists expires_at timestamptz not null default (now() + interval '72 hours');

alter table public.fv_messages enable row level security;

drop policy if exists "Users can read their Fantasy Vault messages" on public.fv_messages;
drop policy if exists "Users can send Fantasy Vault messages" on public.fv_messages;
drop policy if exists "Users can delete their Fantasy Vault messages" on public.fv_messages;

create policy "Users can read their Fantasy Vault messages"
on public.fv_messages for select
to authenticated
using (
  expires_at > now()
  and (auth.uid() = sender_id or auth.uid() = recipient_id)
);

create policy "Users can send Fantasy Vault messages"
on public.fv_messages for insert
to authenticated
with check (
  auth.uid() = sender_id
  and sender_id <> recipient_id
  and body is not null
  and char_length(body) between 1 and 500
  and expires_at <= now() + interval '72 hours 5 minutes'
);

create policy "Users can delete their Fantasy Vault messages"
on public.fv_messages for delete
to authenticated
using (auth.uid() = sender_id or auth.uid() = recipient_id);

create index if not exists fv_messages_conversation_created_idx on public.fv_messages(conversation_id, created_at);
create index if not exists fv_messages_sender_recipient_idx on public.fv_messages(sender_id, recipient_id, created_at);
create index if not exists fv_messages_expires_idx on public.fv_messages(expires_at);

-- Patch: durable 72-hour messages + private photo/albums with custom expiry.
alter table public.fv_messages add column if not exists message_type text not null default 'text';
alter table public.fv_messages add column if not exists media jsonb not null default '[]'::jsonb;
alter table public.fv_messages add column if not exists retention_hours numeric not null default 72;

-- Relax body for media messages while keeping a practical size limit.
alter table public.fv_messages drop constraint if exists fv_messages_body_check;
alter table public.fv_messages add constraint fv_messages_body_check
check (body is null or char_length(body) between 0 and 500);

-- Replace send policy so photos can use shorter custom expiration windows.
drop policy if exists "Users can send Fantasy Vault messages" on public.fv_messages;
create policy "Users can send Fantasy Vault messages"
on public.fv_messages for insert
to authenticated
with check (
  auth.uid() = sender_id
  and sender_id <> recipient_id
  and expires_at > now()
  and expires_at <= now() + interval '72 hours 5 minutes'
  and (body is null or char_length(body) <= 500)
  and message_type in ('text','photo')
);

-- Private chat media bucket. Objects are not public; the app creates short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('fv-private-chat', 'fv-private-chat', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can upload own Fantasy Vault chat media" on storage.objects;
drop policy if exists "Authenticated users can sign Fantasy Vault chat media" on storage.objects;
drop policy if exists "Users can delete own Fantasy Vault chat media" on storage.objects;

create policy "Users can upload own Fantasy Vault chat media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'fv-private-chat'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Needed for signed URL creation. Paths are randomized and message rows are protected by RLS.
create policy "Authenticated users can sign Fantasy Vault chat media"
on storage.objects for select
to authenticated
using (bucket_id = 'fv-private-chat');

create policy "Users can delete own Fantasy Vault chat media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'fv-private-chat'
  and (storage.foldername(name))[1] = auth.uid()::text
);
