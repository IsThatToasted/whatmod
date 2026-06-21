-- Run this in Supabase SQL Editor before deploying the webpage.
-- It creates per-user itinerary tables with Row Level Security.

create extension if not exists pgcrypto;

create table if not exists public.itinerary_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New trip',
  start_date date not null,
  end_date date not null,
  destination text default '',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.itinerary_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  item_date date not null,
  start_time time,
  end_time time,
  item_type text not null default 'event',
  budget numeric(10,2) not null default 0,
  location text default '',
  notes text default '',
  sort_order bigint default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.itinerary_trips enable row level security;
alter table public.itinerary_items enable row level security;

drop policy if exists "Users can read own trips" on public.itinerary_trips;
drop policy if exists "Users can insert own trips" on public.itinerary_trips;
drop policy if exists "Users can update own trips" on public.itinerary_trips;
drop policy if exists "Users can delete own trips" on public.itinerary_trips;

create policy "Users can read own trips" on public.itinerary_trips for select using (auth.uid() = user_id);
create policy "Users can insert own trips" on public.itinerary_trips for insert with check (auth.uid() = user_id);
create policy "Users can update own trips" on public.itinerary_trips for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own trips" on public.itinerary_trips for delete using (auth.uid() = user_id);

drop policy if exists "Users can read own items" on public.itinerary_items;
drop policy if exists "Users can insert own items" on public.itinerary_items;
drop policy if exists "Users can update own items" on public.itinerary_items;
drop policy if exists "Users can delete own items" on public.itinerary_items;

create policy "Users can read own items" on public.itinerary_items for select using (auth.uid() = user_id);
create policy "Users can insert own items" on public.itinerary_items for insert with check (auth.uid() = user_id);
create policy "Users can update own items" on public.itinerary_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own items" on public.itinerary_items for delete using (auth.uid() = user_id);

create index if not exists itinerary_trips_user_id_idx on public.itinerary_trips(user_id);
create index if not exists itinerary_items_trip_id_idx on public.itinerary_items(trip_id);
create index if not exists itinerary_items_user_id_idx on public.itinerary_items(user_id);
