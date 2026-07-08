-- Itinerary Tracker schema with signed-in collaborators + invite links
-- Safe to run more than once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.itinerary_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New trip',
  start_date date not null default current_date,
  end_date date not null default current_date,
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
  sort_order bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.itinerary_trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.itinerary_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  invite_token text,
  created_at timestamptz not null default now(),
  unique(trip_id, user_id)
);

create table if not exists public.itinerary_trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.itinerary_trips(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.current_user_trip_role(target_trip_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.itinerary_trip_members m
  where m.trip_id = target_trip_id
    and m.user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.current_user_trip_role(uuid) to authenticated;

create or replace function public.user_can_view_trip(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.itinerary_trip_members m
    where m.trip_id = target_trip_id
      and m.user_id = auth.uid()
  );
$$;

grant execute on function public.user_can_view_trip(uuid) to authenticated;

create or replace function public.user_can_edit_trip(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.itinerary_trip_members m
    where m.trip_id = target_trip_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'editor')
  );
$$;

grant execute on function public.user_can_edit_trip(uuid) to authenticated;


create or replace function public.create_itinerary_trip(
  trip_title text default 'New trip',
  trip_start_date date default current_date,
  trip_end_date date default current_date
)
returns public.itinerary_trips
language plpgsql
security definer
set search_path = public
as $$
declare
  new_trip public.itinerary_trips%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a trip.';
  end if;

  insert into public.itinerary_trips (user_id, title, start_date, end_date, destination, notes)
  values (
    auth.uid(),
    coalesce(nullif(trim(trip_title), ''), 'New trip'),
    coalesce(trip_start_date, current_date),
    coalesce(trip_end_date, coalesce(trip_start_date, current_date)),
    '',
    ''
  )
  returning * into new_trip;

  insert into public.itinerary_trip_members (trip_id, user_id, role)
  values (new_trip.id, auth.uid(), 'owner')
  on conflict (trip_id, user_id) do update set role = 'owner';

  return new_trip;
end;
$$;

grant execute on function public.create_itinerary_trip(text, date, date) to authenticated;

create or replace function public.add_trip_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.itinerary_trip_members (trip_id, user_id, role)
  values (new.id, new.user_id, 'owner')
  on conflict (trip_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

drop trigger if exists itinerary_trip_owner_member_trigger on public.itinerary_trips;
create trigger itinerary_trip_owner_member_trigger
after insert on public.itinerary_trips
for each row execute function public.add_trip_owner_member();

-- Backfill owner memberships for trips created before this update.
insert into public.itinerary_trip_members (trip_id, user_id, role)
select id, user_id, 'owner'
from public.itinerary_trips
on conflict (trip_id, user_id) do nothing;

create or replace function public.accept_itinerary_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.itinerary_trip_invites%rowtype;
  accepted_trip_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept this invite.';
  end if;

  select * into invite_row
  from public.itinerary_trip_invites
  where token = invite_token
    and revoked_at is null
    and (expires_at is null or expires_at > now())
  limit 1;

  if not found then
    raise exception 'Invite link is invalid, expired, or revoked.';
  end if;

  accepted_trip_id := invite_row.trip_id;

  insert into public.itinerary_trip_members (trip_id, user_id, role, invite_token)
  values (accepted_trip_id, auth.uid(), invite_row.role, invite_token)
  on conflict (trip_id, user_id) do update
    set role = case
      when public.itinerary_trip_members.role = 'owner' then 'owner'
      else excluded.role
    end,
    invite_token = excluded.invite_token;

  return accepted_trip_id;
end;
$$;

grant execute on function public.accept_itinerary_invite(text) to authenticated;

alter table public.itinerary_trips enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.itinerary_trip_members enable row level security;
alter table public.itinerary_trip_invites enable row level security;

-- Clear old policy names and new policy names so reruns do not duplicate/conflict.
drop policy if exists "Users can read own trips" on public.itinerary_trips;
drop policy if exists "Users can insert own trips" on public.itinerary_trips;
drop policy if exists "Users can update own trips" on public.itinerary_trips;
drop policy if exists "Users can delete own trips" on public.itinerary_trips;
drop policy if exists "Members can read trips" on public.itinerary_trips;
drop policy if exists "Users can create trips" on public.itinerary_trips;
drop policy if exists "Editors can update trips" on public.itinerary_trips;
drop policy if exists "Owners can delete trips" on public.itinerary_trips;

create policy "Members can read trips" on public.itinerary_trips
for select using (public.user_can_view_trip(id));

create policy "Users can create trips" on public.itinerary_trips
for insert with check (auth.uid() = user_id);

drop policy if exists "Authenticated can create trips through app" on public.itinerary_trips;
create policy "Authenticated can create trips through app" on public.itinerary_trips
for insert to authenticated
with check (auth.uid() is not null and user_id = auth.uid());


create policy "Editors can update trips" on public.itinerary_trips
for update using (public.user_can_edit_trip(id)) with check (public.user_can_edit_trip(id));

create policy "Owners can delete trips" on public.itinerary_trips
for delete using (public.current_user_trip_role(id) = 'owner');

drop policy if exists "Users can read own items" on public.itinerary_items;
drop policy if exists "Users can insert own items" on public.itinerary_items;
drop policy if exists "Users can update own items" on public.itinerary_items;
drop policy if exists "Users can delete own items" on public.itinerary_items;
drop policy if exists "Members can read items" on public.itinerary_items;
drop policy if exists "Editors can insert items" on public.itinerary_items;
drop policy if exists "Editors can update items" on public.itinerary_items;
drop policy if exists "Editors can delete items" on public.itinerary_items;

create policy "Members can read items" on public.itinerary_items
for select using (public.user_can_view_trip(trip_id));

create policy "Editors can insert items" on public.itinerary_items
for insert with check (auth.uid() = user_id and public.user_can_edit_trip(trip_id));

create policy "Editors can update items" on public.itinerary_items
for update using (public.user_can_edit_trip(trip_id)) with check (public.user_can_edit_trip(trip_id));

create policy "Editors can delete items" on public.itinerary_items
for delete using (public.user_can_edit_trip(trip_id));

drop policy if exists "Members can read members" on public.itinerary_trip_members;
drop policy if exists "Owners can manage members" on public.itinerary_trip_members;
drop policy if exists "Users can see their own memberships" on public.itinerary_trip_members;

create policy "Members can read members" on public.itinerary_trip_members
for select using (public.user_can_view_trip(trip_id));

create policy "Owners can manage members" on public.itinerary_trip_members
for all using (public.current_user_trip_role(trip_id) = 'owner') with check (public.current_user_trip_role(trip_id) = 'owner');

drop policy if exists "Members can read invites" on public.itinerary_trip_invites;
drop policy if exists "Editors can create invites" on public.itinerary_trip_invites;
drop policy if exists "Owners can update invites" on public.itinerary_trip_invites;

create policy "Members can read invites" on public.itinerary_trip_invites
for select using (public.user_can_view_trip(trip_id));

create policy "Editors can create invites" on public.itinerary_trip_invites
for insert with check (auth.uid() = created_by and public.user_can_edit_trip(trip_id));

create policy "Owners can update invites" on public.itinerary_trip_invites
for update using (public.current_user_trip_role(trip_id) = 'owner') with check (public.current_user_trip_role(trip_id) = 'owner');

create index if not exists itinerary_trips_user_id_idx on public.itinerary_trips(user_id);
create index if not exists itinerary_items_trip_id_idx on public.itinerary_items(trip_id);
create index if not exists itinerary_items_user_id_idx on public.itinerary_items(user_id);
create index if not exists itinerary_trip_members_trip_id_idx on public.itinerary_trip_members(trip_id);
create index if not exists itinerary_trip_members_user_id_idx on public.itinerary_trip_members(user_id);
create index if not exists itinerary_trip_invites_trip_id_idx on public.itinerary_trip_invites(trip_id);
create index if not exists itinerary_trip_invites_token_idx on public.itinerary_trip_invites(token);


-- Per-user packing lists. Each traveler has their own list for the same trip.
create table if not exists public.itinerary_packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.itinerary_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  packed boolean not null default false,
  sort_order bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.itinerary_packing_items enable row level security;

drop policy if exists "Members can read own packing items" on public.itinerary_packing_items;
drop policy if exists "Editors can insert own packing items" on public.itinerary_packing_items;
drop policy if exists "Editors can update own packing items" on public.itinerary_packing_items;
drop policy if exists "Editors can delete own packing items" on public.itinerary_packing_items;

create policy "Members can read own packing items" on public.itinerary_packing_items
for select using (auth.uid() = user_id and public.user_can_view_trip(trip_id));

create policy "Editors can insert own packing items" on public.itinerary_packing_items
for insert with check (auth.uid() = user_id and public.user_can_edit_trip(trip_id));

create policy "Editors can update own packing items" on public.itinerary_packing_items
for update using (auth.uid() = user_id and public.user_can_edit_trip(trip_id)) with check (auth.uid() = user_id and public.user_can_edit_trip(trip_id));

create policy "Editors can delete own packing items" on public.itinerary_packing_items
for delete using (auth.uid() = user_id and public.user_can_edit_trip(trip_id));

create index if not exists itinerary_packing_items_trip_user_idx on public.itinerary_packing_items(trip_id, user_id);

-- v18 Rain Plan support for itinerary item card flip.
alter table public.itinerary_items
  add column if not exists rain_plan text default '';


-- v26 Shared Must Do Together list. This is trip-wide, not isolated per traveler.
create table if not exists public.itinerary_must_do_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.itinerary_trips(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text default '',
  location text default '',
  priority text not null default 'want' check (priority in ('must','want','maybe')),
  completed boolean not null default false,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  sort_order bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.itinerary_must_do_items enable row level security;

drop policy if exists "Members can read shared must do" on public.itinerary_must_do_items;
drop policy if exists "Editors can insert shared must do" on public.itinerary_must_do_items;
drop policy if exists "Editors can update shared must do" on public.itinerary_must_do_items;
drop policy if exists "Editors can delete shared must do" on public.itinerary_must_do_items;

create policy "Members can read shared must do" on public.itinerary_must_do_items
for select using (public.user_can_view_trip(trip_id));

create policy "Editors can insert shared must do" on public.itinerary_must_do_items
for insert with check (auth.uid() = created_by and public.user_can_edit_trip(trip_id));

create policy "Editors can update shared must do" on public.itinerary_must_do_items
for update using (public.user_can_edit_trip(trip_id)) with check (public.user_can_edit_trip(trip_id));

create policy "Editors can delete shared must do" on public.itinerary_must_do_items
for delete using (public.user_can_edit_trip(trip_id));

create index if not exists itinerary_must_do_trip_idx on public.itinerary_must_do_items(trip_id, completed, sort_order);

-- v26 Shared trip memories. Lightweight text notes; media URLs can be added later without breaking this table.
create table if not exists public.itinerary_memories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.itinerary_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  location text default '',
  memory_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.itinerary_memories enable row level security;

drop policy if exists "Members can read memories" on public.itinerary_memories;
drop policy if exists "Editors can insert memories" on public.itinerary_memories;
drop policy if exists "Editors can update own memories" on public.itinerary_memories;
drop policy if exists "Editors can delete memories" on public.itinerary_memories;

create policy "Members can read memories" on public.itinerary_memories
for select using (public.user_can_view_trip(trip_id));

create policy "Editors can insert memories" on public.itinerary_memories
for insert with check (auth.uid() = user_id and public.user_can_edit_trip(trip_id));

create policy "Editors can update own memories" on public.itinerary_memories
for update using (auth.uid() = user_id and public.user_can_edit_trip(trip_id)) with check (auth.uid() = user_id and public.user_can_edit_trip(trip_id));

create policy "Editors can delete memories" on public.itinerary_memories
for delete using (public.user_can_edit_trip(trip_id));

create index if not exists itinerary_memories_trip_idx on public.itinerary_memories(trip_id, created_at desc);

-- v28 Budgeted Must Do items + trip gas calculator fields.
alter table public.itinerary_must_do_items
  add column if not exists budget numeric(10,2) not null default 0;

alter table public.itinerary_trips
  add column if not exists gas_miles numeric(10,1) not null default 0,
  add column if not exists gas_mpg numeric(10,1) not null default 0,
  add column if not exists gas_price numeric(10,2) not null default 0;
