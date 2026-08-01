-- Memories by WhatMod
-- Run this entire file in the Supabase SQL Editor for:
-- https://gapqvyfoxxyoymtogvbt.supabase.co
-- Safe to rerun. Existing user data is preserved.

create extension if not exists pgcrypto;

create or replace function public.memory_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.memory_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'My archive',
  avatar_url text,
  current_chapter text not null default 'The chapter I am living',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  body text not null default '',
  memory_type text not null default 'memory' check (memory_type in ('memory','fragment')),
  occurred_on date,
  date_precision text not null default 'exact' check (date_precision in ('exact','month','season','year','approximate','unknown')),
  time_of_day text,
  life_chapter text not null default '',
  emotions text[] not null default '{}',
  sensory jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  certainty text not null default 'likely' check (certainty in ('confirmed','likely','uncertain','reconstructed')),
  visibility text not null default 'private' check (visibility in ('private','shared')),
  is_favorite boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_id uuid not null references public.memories(id) on delete cascade,
  storage_path text not null,
  media_type text not null default 'image' check (media_type in ('image','video','audio','document')),
  mime_type text,
  original_name text,
  caption text not null default '',
  captured_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, storage_path)
);

create table if not exists public.memory_people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  normalized_name text generated always as (lower(btrim(name))) stored,
  kind text not null default '',
  notes text not null default '',
  color text not null default 'violet' check (color in ('violet','rose','amber','aqua','sage')),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create table if not exists public.memory_person_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_id uuid not null references public.memories(id) on delete cascade,
  person_id uuid not null references public.memory_people(id) on delete cascade,
  perspective_note text not null default '',
  created_at timestamptz not null default now(),
  unique (memory_id, person_id)
);

create table if not exists public.memory_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  normalized_name text generated always as (lower(btrim(name))) stored,
  kind text not null default '',
  notes text not null default '',
  color text not null default 'aqua' check (color in ('violet','rose','amber','aqua','sage')),
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create table if not exists public.memory_place_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_id uuid not null references public.memories(id) on delete cascade,
  place_id uuid not null references public.memory_places(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (memory_id, place_id)
);

create table if not exists public.memory_life_chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 140),
  normalized_name text generated always as (lower(btrim(name))) stored,
  description text not null default '',
  color text not null default 'violet' check (color in ('violet','rose','amber','aqua','sage')),
  start_year integer check (start_year is null or start_year between 1800 and 2200),
  end_year integer check (end_year is null or end_year between 1800 and 2200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_name),
  check (end_year is null or start_year is null or end_year >= start_year)
);

create table if not exists public.memory_pathways (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  icon text not null default '〰',
  color text not null default 'violet' check (color in ('violet','rose','amber','aqua','sage')),
  visibility text not null default 'private' check (visibility in ('private','shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_pathway_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pathway_id uuid not null references public.memory_pathways(id) on delete cascade,
  memory_id uuid not null references public.memories(id) on delete cascade,
  annotation text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (pathway_id, memory_id)
);

create table if not exists public.memory_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_memory_id uuid not null references public.memories(id) on delete cascade,
  target_memory_id uuid not null references public.memories(id) on delete cascade,
  relation_type text not null default 'related' check (relation_type in ('related','person','place','chapter','time','evidence','continuation','contrast')),
  note text not null default '',
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now(),
  unique (source_memory_id, target_memory_id, relation_type),
  check (source_memory_id <> target_memory_id)
);

create index if not exists memories_user_date_idx on public.memories(user_id, occurred_on desc nulls last);
create index if not exists memories_user_created_idx on public.memories(user_id, created_at desc);
create index if not exists memories_tags_gin_idx on public.memories using gin(tags);
create index if not exists memories_emotions_gin_idx on public.memories using gin(emotions);
create index if not exists memory_media_memory_idx on public.memory_media(memory_id, sort_order);
create index if not exists memory_person_links_memory_idx on public.memory_person_links(memory_id);
create index if not exists memory_person_links_person_idx on public.memory_person_links(person_id);
create index if not exists memory_place_links_memory_idx on public.memory_place_links(memory_id);
create index if not exists memory_place_links_place_idx on public.memory_place_links(place_id);
create index if not exists memory_pathway_items_path_idx on public.memory_pathway_items(pathway_id, sort_order);
create index if not exists memory_links_source_idx on public.memory_links(source_memory_id);
create index if not exists memory_links_target_idx on public.memory_links(target_memory_id);

-- Keep updated_at accurate.
drop trigger if exists memory_profiles_updated_at on public.memory_profiles;
create trigger memory_profiles_updated_at before update on public.memory_profiles for each row execute function public.memory_set_updated_at();
drop trigger if exists memories_updated_at on public.memories;
create trigger memories_updated_at before update on public.memories for each row execute function public.memory_set_updated_at();
drop trigger if exists memory_people_updated_at on public.memory_people;
create trigger memory_people_updated_at before update on public.memory_people for each row execute function public.memory_set_updated_at();
drop trigger if exists memory_places_updated_at on public.memory_places;
create trigger memory_places_updated_at before update on public.memory_places for each row execute function public.memory_set_updated_at();
drop trigger if exists memory_life_chapters_updated_at on public.memory_life_chapters;
create trigger memory_life_chapters_updated_at before update on public.memory_life_chapters for each row execute function public.memory_set_updated_at();
drop trigger if exists memory_pathways_updated_at on public.memory_pathways;
create trigger memory_pathways_updated_at before update on public.memory_pathways for each row execute function public.memory_set_updated_at();

-- Create a matching private profile whenever a user signs up.
create or replace function public.memory_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.memory_profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'My archive'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists memory_on_auth_user_created on auth.users;
create trigger memory_on_auth_user_created
after insert on auth.users
for each row execute function public.memory_handle_new_user();

-- Backfill profiles for users who existed before this schema was run.
insert into public.memory_profiles (id, display_name)
select id, coalesce(nullif(raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(email, 'My archive'), '@', 1))
from auth.users
on conflict (id) do nothing;

-- Row Level Security: every record remains private to its owner.
alter table public.memory_profiles enable row level security;
alter table public.memories enable row level security;
alter table public.memory_media enable row level security;
alter table public.memory_people enable row level security;
alter table public.memory_person_links enable row level security;
alter table public.memory_places enable row level security;
alter table public.memory_place_links enable row level security;
alter table public.memory_life_chapters enable row level security;
alter table public.memory_pathways enable row level security;
alter table public.memory_pathway_items enable row level security;
alter table public.memory_links enable row level security;

-- Recreate simple owner-only policies so reruns stay predictable.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'memory_profiles','memories','memory_media','memory_people','memory_person_links',
    'memory_places','memory_place_links','memory_life_chapters','memory_pathways',
    'memory_pathway_items','memory_links'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_delete', table_name);
  end loop;
end $$;

create policy memory_profiles_owner_select on public.memory_profiles for select using (id = auth.uid());
create policy memory_profiles_owner_insert on public.memory_profiles for insert with check (id = auth.uid());
create policy memory_profiles_owner_update on public.memory_profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy memory_profiles_owner_delete on public.memory_profiles for delete using (id = auth.uid());

create policy memories_owner_select on public.memories for select using (user_id = auth.uid());
create policy memories_owner_insert on public.memories for insert with check (user_id = auth.uid());
create policy memories_owner_update on public.memories for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy memories_owner_delete on public.memories for delete using (user_id = auth.uid());

create policy memory_media_owner_select on public.memory_media for select using (user_id = auth.uid());
create policy memory_media_owner_insert on public.memory_media for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.memories m where m.id = memory_id and m.user_id = auth.uid())
);
create policy memory_media_owner_update on public.memory_media for update using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and exists (select 1 from public.memories m where m.id = memory_id and m.user_id = auth.uid())
);
create policy memory_media_owner_delete on public.memory_media for delete using (user_id = auth.uid());

create policy memory_people_owner_select on public.memory_people for select using (user_id = auth.uid());
create policy memory_people_owner_insert on public.memory_people for insert with check (user_id = auth.uid());
create policy memory_people_owner_update on public.memory_people for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy memory_people_owner_delete on public.memory_people for delete using (user_id = auth.uid());

create policy memory_person_links_owner_select on public.memory_person_links for select using (user_id = auth.uid());
create policy memory_person_links_owner_insert on public.memory_person_links for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.memories m where m.id = memory_id and m.user_id = auth.uid())
  and exists (select 1 from public.memory_people p where p.id = person_id and p.user_id = auth.uid())
);
create policy memory_person_links_owner_update on public.memory_person_links for update using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and exists (select 1 from public.memories m where m.id = memory_id and m.user_id = auth.uid())
  and exists (select 1 from public.memory_people p where p.id = person_id and p.user_id = auth.uid())
);
create policy memory_person_links_owner_delete on public.memory_person_links for delete using (user_id = auth.uid());

create policy memory_places_owner_select on public.memory_places for select using (user_id = auth.uid());
create policy memory_places_owner_insert on public.memory_places for insert with check (user_id = auth.uid());
create policy memory_places_owner_update on public.memory_places for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy memory_places_owner_delete on public.memory_places for delete using (user_id = auth.uid());

create policy memory_place_links_owner_select on public.memory_place_links for select using (user_id = auth.uid());
create policy memory_place_links_owner_insert on public.memory_place_links for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.memories m where m.id = memory_id and m.user_id = auth.uid())
  and exists (select 1 from public.memory_places p where p.id = place_id and p.user_id = auth.uid())
);
create policy memory_place_links_owner_update on public.memory_place_links for update using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and exists (select 1 from public.memories m where m.id = memory_id and m.user_id = auth.uid())
  and exists (select 1 from public.memory_places p where p.id = place_id and p.user_id = auth.uid())
);
create policy memory_place_links_owner_delete on public.memory_place_links for delete using (user_id = auth.uid());

create policy memory_life_chapters_owner_select on public.memory_life_chapters for select using (user_id = auth.uid());
create policy memory_life_chapters_owner_insert on public.memory_life_chapters for insert with check (user_id = auth.uid());
create policy memory_life_chapters_owner_update on public.memory_life_chapters for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy memory_life_chapters_owner_delete on public.memory_life_chapters for delete using (user_id = auth.uid());

create policy memory_pathways_owner_select on public.memory_pathways for select using (user_id = auth.uid());
create policy memory_pathways_owner_insert on public.memory_pathways for insert with check (user_id = auth.uid());
create policy memory_pathways_owner_update on public.memory_pathways for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy memory_pathways_owner_delete on public.memory_pathways for delete using (user_id = auth.uid());

create policy memory_pathway_items_owner_select on public.memory_pathway_items for select using (user_id = auth.uid());
create policy memory_pathway_items_owner_insert on public.memory_pathway_items for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.memory_pathways p where p.id = pathway_id and p.user_id = auth.uid())
  and exists (select 1 from public.memories m where m.id = memory_id and m.user_id = auth.uid())
);
create policy memory_pathway_items_owner_update on public.memory_pathway_items for update using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and exists (select 1 from public.memory_pathways p where p.id = pathway_id and p.user_id = auth.uid())
  and exists (select 1 from public.memories m where m.id = memory_id and m.user_id = auth.uid())
);
create policy memory_pathway_items_owner_delete on public.memory_pathway_items for delete using (user_id = auth.uid());

create policy memory_links_owner_select on public.memory_links for select using (user_id = auth.uid());
create policy memory_links_owner_insert on public.memory_links for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.memories m where m.id = source_memory_id and m.user_id = auth.uid())
  and exists (select 1 from public.memories m where m.id = target_memory_id and m.user_id = auth.uid())
);
create policy memory_links_owner_update on public.memory_links for update using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and exists (select 1 from public.memories m where m.id = source_memory_id and m.user_id = auth.uid())
  and exists (select 1 from public.memories m where m.id = target_memory_id and m.user_id = auth.uid())
);
create policy memory_links_owner_delete on public.memory_links for delete using (user_id = auth.uid());

-- Private media bucket. Files are stored under user-id/memory-id/filename.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memory-media',
  'memory-media',
  false,
  52428800,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','audio/mpeg','audio/mp4','audio/wav','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists memory_media_storage_select on storage.objects;
drop policy if exists memory_media_storage_insert on storage.objects;
drop policy if exists memory_media_storage_update on storage.objects;
drop policy if exists memory_media_storage_delete on storage.objects;

create policy memory_media_storage_select on storage.objects
for select using (
  bucket_id = 'memory-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy memory_media_storage_insert on storage.objects
for insert with check (
  bucket_id = 'memory-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy memory_media_storage_update on storage.objects
for update using (
  bucket_id = 'memory-media'
  and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'memory-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy memory_media_storage_delete on storage.objects
for delete using (
  bucket_id = 'memory-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow the web app to use these objects through PostgREST.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table
  public.memory_profiles,
  public.memories,
  public.memory_media,
  public.memory_people,
  public.memory_person_links,
  public.memory_places,
  public.memory_place_links,
  public.memory_life_chapters,
  public.memory_pathways,
  public.memory_pathway_items,
  public.memory_links
  to authenticated;
grant execute on function public.memory_set_updated_at() to authenticated;

-- Realtime keeps multiple devices in sync. Duplicate-object exceptions are harmless on rerun.
do $$
begin
  alter publication supabase_realtime add table public.memories;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.memory_media;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.memory_people;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.memory_places;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.memory_pathways;
exception when duplicate_object then null;
end $$;

-- Optional verification queries:
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename like 'memory%';
-- select id, name, public from storage.buckets where id = 'memory-media';
