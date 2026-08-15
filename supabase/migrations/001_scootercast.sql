create extension if not exists pgcrypto;

create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Scooter Ride',
  share_slug text not null unique,
  room_name text not null unique,
  is_discoverable boolean not null default false,
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


-- V1.4 upgrade for existing ScooterCast installations.
alter table public.rides
  add column if not exists is_discoverable boolean not null default false;

create index if not exists rides_live_discoverable_idx
  on public.rides (status, is_discoverable, started_at desc);


-- V1.5 usage estimator support.
create table if not exists public.viewer_sessions (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists viewer_sessions_ride_idx
  on public.viewer_sessions (ride_id, first_seen desc);

create index if not exists viewer_sessions_month_idx
  on public.viewer_sessions (first_seen desc);

alter table public.viewer_sessions enable row level security;

-- Viewer session writes/reads are performed only through ride-api using service role.


-- V2.0 motion-quality telemetry additions.
alter table public.ride_telemetry
  add column if not exists average_speed_mph double precision not null default 0,
  add column if not exists max_speed_mph double precision not null default 0,
  add column if not exists speed_accuracy_mps double precision,
  add column if not exists course_accuracy_degrees double precision,
  add column if not exists gps_quality text,
  add column if not exists moving_seconds integer not null default 0;

-- V2.0 viewer interactions and Save Moment.
create table if not exists public.ride_events (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  event_type text not null check (event_type in ('reaction', 'moment')),
  emoji text,
  label text,
  created_at timestamptz not null default now()
);

create index if not exists ride_events_ride_time_idx
  on public.ride_events (ride_id, created_at desc);

alter table public.ride_events enable row level security;

-- Event access goes through ride-api using its service-role client.
