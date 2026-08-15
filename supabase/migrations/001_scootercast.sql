create extension if not exists pgcrypto;

create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Scooter Ride',
  share_slug text not null unique,
  room_name text not null unique,
  status text not null default 'live'
    check (status in ('live', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  expires_at timestamptz not null default (now() + interval '8 hours'),
  created_at timestamptz not null default now()
);

create table if not exists public.ride_telemetry (
  id bigint generated always as identity primary key,
  ride_id uuid not null references public.rides(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  speed_mph double precision not null default 0,
  heading double precision not null default 0,
  altitude_ft double precision not null default 0,
  horizontal_accuracy_m double precision,
  distance_miles double precision not null default 0,
  phone_battery double precision,
  elapsed_seconds integer not null default 0,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists ride_telemetry_ride_time_idx
  on public.ride_telemetry (ride_id, captured_at desc);

create index if not exists rides_share_slug_idx
  on public.rides (share_slug);

alter table public.rides enable row level security;
alter table public.ride_telemetry enable row level security;

drop policy if exists "public can read active rides" on public.rides;
create policy "public can read active rides"
on public.rides
for select
to anon, authenticated
using (
  status = 'live'
  and expires_at > now()
);

drop policy if exists "public can read telemetry for active rides"
on public.ride_telemetry;

create policy "public can read telemetry for active rides"
on public.ride_telemetry
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.rides r
    where r.id = ride_telemetry.ride_id
      and r.status = 'live'
      and r.expires_at > now()
  )
);

do $$
begin
  alter publication supabase_realtime
    add table public.ride_telemetry;
exception
  when duplicate_object then null;
end $$;
