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
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  unique(trip_id, user_id)
);

alter table public.itinerary_trip_members add column if not exists display_name text;
alter table public.itinerary_trip_members add column if not exists avatar_url text;

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

  insert into public.itinerary_trip_members (trip_id, user_id, role, display_name, avatar_url)
  values (new_trip.id, auth.uid(), 'owner', coalesce(auth.jwt()->'user_metadata'->>'full_name', auth.jwt()->'user_metadata'->>'name', auth.jwt()->>'email'), coalesce(auth.jwt()->'user_metadata'->>'avatar_url', auth.jwt()->'user_metadata'->>'picture'))
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
drop policy if exists "Users can update own member profile" on public.itinerary_trip_members;

create policy "Members can read members" on public.itinerary_trip_members
for select using (public.user_can_view_trip(trip_id));

create policy "Owners can manage members" on public.itinerary_trip_members
for all using (public.current_user_trip_role(trip_id) = 'owner') with check (public.current_user_trip_role(trip_id) = 'owner');

create policy "Users can update own member profile" on public.itinerary_trip_members
for update using (auth.uid() = user_id and public.user_can_view_trip(trip_id))
with check (auth.uid() = user_id and public.user_can_view_trip(trip_id));

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
  assigned_to uuid references auth.users(id) on delete set null,
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

-- v31 Point-to-point routing and assignee support.
alter table public.itinerary_items
  add column if not exists from_location text default '',
  add column if not exists to_location text default '',
  add column if not exists assigned_to uuid references auth.users(id) on delete set null;

create index if not exists itinerary_items_assigned_to_idx on public.itinerary_items(assigned_to);


-- v32 Card locking to prevent accidental edits/moves.
alter table public.itinerary_items
  add column if not exists locked boolean not null default false,
  add column if not exists locked_by uuid references auth.users(id) on delete set null,
  add column if not exists locked_at timestamptz;

create index if not exists itinerary_items_locked_idx on public.itinerary_items(trip_id, locked);


-- v33 Shared packing progress counts only. Item labels remain private by RLS.
create or replace function public.get_itinerary_packing_progress(target_trip_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  packed_count bigint,
  total_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    m.user_id,
    coalesce(m.display_name, 'Traveler') as display_name,
    coalesce(m.avatar_url, '') as avatar_url,
    count(p.id) filter (where p.packed) as packed_count,
    count(p.id) as total_count
  from public.itinerary_trip_members m
  left join public.itinerary_packing_items p
    on p.trip_id = m.trip_id and p.user_id = m.user_id
  where m.trip_id = target_trip_id
    and public.user_can_view_trip(target_trip_id)
  group by m.user_id, m.display_name, m.avatar_url, m.created_at
  order by m.created_at;
$$;

grant execute on function public.get_itinerary_packing_progress(uuid) to authenticated;

-- v36 Hidden Fun Ideas + Photo Memories
alter table public.itinerary_memories add column if not exists photo_url text default '';
alter table public.itinerary_memories add column if not exists photo_path text default '';

create table if not exists public.trip_fun_permissions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.itinerary_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  can_access boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(trip_id, user_id)
);


create table if not exists public.trip_fun_categories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.itinerary_trips(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text not null default '✨',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_fun_ideas (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.itinerary_trips(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  category_id uuid references public.trip_fun_categories(id) on delete set null,
  title text not null,
  description text default '',
  play_type text not null default 'private' check (play_type in ('private','public')),
  visibility text not null default 'shared' check (visibility in ('shared','private')),
  status text not null default 'planned' check (status in ('planned','maybe','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


alter table public.trip_fun_ideas add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.trip_fun_ideas add column if not exists category_id uuid references public.trip_fun_categories(id) on delete set null;

alter table public.trip_fun_permissions enable row level security;
alter table public.trip_fun_categories enable row level security;
alter table public.trip_fun_ideas enable row level security;

drop policy if exists "fun permissions visible to trip members" on public.trip_fun_permissions;
create policy "fun permissions visible to trip members" on public.trip_fun_permissions
  for select using (public.user_can_view_trip(trip_id));

drop policy if exists "owner manages fun permissions" on public.trip_fun_permissions;
create policy "owner manages fun permissions" on public.trip_fun_permissions
  for all using (public.current_user_trip_role(trip_id) = 'owner')
  with check (public.current_user_trip_role(trip_id) = 'owner');


drop policy if exists "fun categories visible to permitted users" on public.trip_fun_categories;
create policy "fun categories visible to permitted users" on public.trip_fun_categories
  for select using (
    public.current_user_trip_role(trip_id) = 'owner'
    or exists (
      select 1 from public.trip_fun_permissions p
      where p.trip_id = trip_fun_categories.trip_id and p.user_id = auth.uid() and p.can_access = true
    )
  );

drop policy if exists "owner manages fun categories" on public.trip_fun_categories;
drop policy if exists "permitted editors manage fun categories" on public.trip_fun_categories;
create policy "permitted editors manage fun categories" on public.trip_fun_categories
  for all using (
    public.user_can_edit_trip(trip_id) and (
      public.current_user_trip_role(trip_id) = 'owner'
      or exists (select 1 from public.trip_fun_permissions p where p.trip_id = trip_fun_categories.trip_id and p.user_id = auth.uid() and p.can_access = true)
    )
  ) with check (
    public.user_can_edit_trip(trip_id) and (
      public.current_user_trip_role(trip_id) = 'owner'
      or exists (select 1 from public.trip_fun_permissions p where p.trip_id = trip_fun_categories.trip_id and p.user_id = auth.uid() and p.can_access = true)
    )
  );

drop policy if exists "fun ideas visible to permitted users" on public.trip_fun_ideas;
create policy "fun ideas visible to permitted users" on public.trip_fun_ideas
  for select using (
    public.current_user_trip_role(trip_id) = 'owner'
    or created_by = auth.uid()
    or exists (
      select 1 from public.trip_fun_permissions p
      where p.trip_id = trip_fun_ideas.trip_id and p.user_id = auth.uid() and p.can_access = true
    )
  );

drop policy if exists "permitted editors manage fun ideas" on public.trip_fun_ideas;
create policy "permitted editors manage fun ideas" on public.trip_fun_ideas
  for all using (
    public.user_can_edit_trip(trip_id) and (
      public.current_user_trip_role(trip_id) = 'owner'
      or created_by = auth.uid()
      or exists (select 1 from public.trip_fun_permissions p where p.trip_id = trip_fun_ideas.trip_id and p.user_id = auth.uid() and p.can_access = true)
    )
  ) with check (
    public.user_can_edit_trip(trip_id) and (
      public.current_user_trip_role(trip_id) = 'owner'
      or created_by = auth.uid()
      or exists (select 1 from public.trip_fun_permissions p where p.trip_id = trip_fun_ideas.trip_id and p.user_id = auth.uid() and p.can_access = true)
    )
  );

-- Public storage bucket for photo memories. Paths are still protected by object policies for upload/delete.
insert into storage.buckets (id, name, public)
values ('trip-memories', 'trip-memories', true)
on conflict (id) do update set public = true;

drop policy if exists "trip memory photos readable" on storage.objects;
create policy "trip memory photos readable" on storage.objects
  for select using (bucket_id = 'trip-memories');

drop policy if exists "trip members upload memory photos" on storage.objects;
create policy "trip members upload memory photos" on storage.objects
  for insert with check (
    bucket_id = 'trip-memories'
    and auth.uid()::text = (storage.foldername(name))[2]
    and public.user_can_edit_trip(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "trip members delete own memory photos" on storage.objects;
create policy "trip members delete own memory photos" on storage.objects
  for delete using (
    bucket_id = 'trip-memories'
    and auth.uid()::text = (storage.foldername(name))[2]
    and public.user_can_edit_trip(((storage.foldername(name))[1])::uuid)
  );

-- v37 Packing progress accuracy + realtime collaboration
-- Replaces the packing progress helper with a duplicate-safe version that counts ONLY
-- each traveler's own packing rows, without exposing item names.
create or replace function public.get_itinerary_packing_progress(target_trip_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  packed_count bigint,
  total_count bigint
)
language sql
security definer
set search_path = public
as $$
  with member_base as (
    select distinct on (m.user_id)
      m.user_id,
      coalesce(nullif(m.display_name, ''), 'Traveler') as display_name,
      coalesce(m.avatar_url, '') as avatar_url,
      m.created_at
    from public.itinerary_trip_members m
    where m.trip_id = target_trip_id
      and public.user_can_view_trip(target_trip_id)
    order by m.user_id, m.created_at asc
  ), packing_counts as (
    select
      p.user_id,
      count(*) filter (where p.packed is true) as packed_count,
      count(*) as total_count
    from public.itinerary_packing_items p
    where p.trip_id = target_trip_id
    group by p.user_id
  )
  select
    m.user_id,
    m.display_name,
    m.avatar_url,
    coalesce(pc.packed_count, 0)::bigint as packed_count,
    coalesce(pc.total_count, 0)::bigint as total_count
  from member_base m
  left join packing_counts pc on pc.user_id = m.user_id
  order by m.created_at;
$$;

grant execute on function public.get_itinerary_packing_progress(uuid) to authenticated;

-- Try to enable Supabase Realtime for collaborative trip tables.
-- If a table is already in the publication, this safely skips it.
do $$
declare
  t text;
begin
  foreach t in array array[
    'itinerary_items',
    'itinerary_trip_members',
    'itinerary_packing_items',
    'itinerary_must_do',
    'itinerary_memories',
    'trip_fun_permissions',
    'trip_fun_ideas',
    'trip_fun_categories',
    'itinerary_shopping_items',
    'itinerary_shopping_permissions'
  ] loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t)
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- v52 Shopping lists attached to Shopping itinerary events
create table if not exists public.itinerary_shopping_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.itinerary_trips(id) on delete cascade,
  itinerary_item_id uuid not null references public.itinerary_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  quantity numeric default 1,
  notes text default '',
  completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.itinerary_shopping_permissions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.itinerary_trips(id) on delete cascade,
  itinerary_item_id uuid not null references public.itinerary_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  can_access boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(itinerary_item_id, user_id)
);

alter table public.itinerary_shopping_items enable row level security;
alter table public.itinerary_shopping_permissions enable row level security;

create index if not exists itinerary_shopping_items_trip_item_idx on public.itinerary_shopping_items(trip_id, itinerary_item_id);
create index if not exists itinerary_shopping_permissions_trip_item_idx on public.itinerary_shopping_permissions(trip_id, itinerary_item_id);

create or replace function public.user_can_access_shopping_list(target_item_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.itinerary_items i
    where i.id = target_item_id
      and public.user_can_view_trip(i.trip_id)
      and (
        public.current_user_trip_role(i.trip_id) = 'owner'
        or i.user_id = auth.uid()
        or exists (
          select 1 from public.itinerary_shopping_permissions p
          where p.itinerary_item_id = target_item_id
            and p.user_id = auth.uid()
            and p.can_access = true
        )
      )
  );
$$;

grant execute on function public.user_can_access_shopping_list(uuid) to authenticated;

drop policy if exists "shopping list visible to permitted users" on public.itinerary_shopping_items;
create policy "shopping list visible to permitted users" on public.itinerary_shopping_items
  for select using (public.user_can_access_shopping_list(itinerary_item_id));

drop policy if exists "shopping list editable by permitted editors" on public.itinerary_shopping_items;
create policy "shopping list editable by permitted editors" on public.itinerary_shopping_items
  for all using (public.user_can_edit_trip(trip_id) and public.user_can_access_shopping_list(itinerary_item_id))
  with check (public.user_can_edit_trip(trip_id) and public.user_can_access_shopping_list(itinerary_item_id));

drop policy if exists "shopping permissions visible to trip members" on public.itinerary_shopping_permissions;
create policy "shopping permissions visible to trip members" on public.itinerary_shopping_permissions
  for select using (public.user_can_view_trip(trip_id));

drop policy if exists "shopping permissions managed by owner or event creator" on public.itinerary_shopping_permissions;
create policy "shopping permissions managed by owner or event creator" on public.itinerary_shopping_permissions
  for all using (
    public.current_user_trip_role(trip_id) = 'owner'
    or exists (select 1 from public.itinerary_items i where i.id = itinerary_item_id and i.user_id = auth.uid())
  ) with check (
    public.current_user_trip_role(trip_id) = 'owner'
    or exists (select 1 from public.itinerary_items i where i.id = itinerary_item_id and i.user_id = auth.uid())
  );

-- Add shopping tables to realtime if available.
do $$
declare
  t text;
begin
  foreach t in array array['itinerary_shopping_items','itinerary_shopping_permissions'] loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t)
       and not exists (
         select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- v60 Database cleanup + safer trip deletion
-- Fixes old empty starter-trip buildup and makes trip deletion clean up related rows/storage metadata.

create or replace function public.delete_itinerary_trip_cascade(target_trip_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if public.current_user_trip_role(target_trip_id) <> 'owner' then
    raise exception 'Only the trip owner can delete this trip.';
  end if;

  -- Remove memory photo objects whose storage path starts with trip_id/user_id/...
  -- This keeps Supabase Storage from growing after a trip is deleted.
  begin
    delete from storage.objects
    where bucket_id = 'trip-memories'
      and (storage.foldername(name))[1] = target_trip_id::text;
  exception when others then
    -- Keep the trip deletion working even if Storage is not configured yet.
    null;
  end;

  -- Most app tables already have ON DELETE CASCADE from itinerary_trips.
  -- Deleting the trip is the source of truth and cascades child data.
  delete from public.itinerary_trips
  where id = target_trip_id;

  return true;
end;
$$;

grant execute on function public.delete_itinerary_trip_cascade(uuid) to authenticated;

create or replace function public.cleanup_duplicate_empty_itinerary_starters()
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  removed_count integer := 0;
begin
  if auth.uid() is null then
    return 0;
  end if;

  -- Remove duplicate empty starter trips for the signed-in user.
  -- A starter is only considered empty if it has no itinerary items, must-do items,
  -- memories, fun ideas, or shopping items. Personal starter packing rows are ignored
  -- so old empty templates can still be cleaned up.
  with user_trips as (
    select t.id, t.created_at,
      exists(select 1 from public.itinerary_items i where i.trip_id = t.id) as has_items,
      exists(select 1 from public.itinerary_must_do_items m where m.trip_id = t.id) as has_must,
      exists(select 1 from public.itinerary_memories mem where mem.trip_id = t.id) as has_memories,
      exists(select 1 from public.trip_fun_ideas f where f.trip_id = t.id) as has_fun,
      exists(select 1 from public.itinerary_shopping_items s where s.trip_id = t.id) as has_shopping
    from public.itinerary_trips t
    where t.user_id = auth.uid()
      and lower(coalesce(t.title, '')) in ('my trip', 'new trip', 'untitled trip')
  ), empty_starters as (
    select id, created_at
    from user_trips
    where not (has_items or has_must or has_memories or has_fun or has_shopping)
  ), real_trip_count as (
    select count(*)::int as n
    from public.itinerary_trips t
    where t.user_id = auth.uid()
      and not exists (select 1 from empty_starters e where e.id = t.id)
  ), to_delete as (
    select e.id
    from empty_starters e, real_trip_count r
    where r.n > 0
       or e.id not in (select id from empty_starters order by created_at asc limit 1)
  ), deleted_storage as (
    delete from storage.objects o
    using to_delete d
    where o.bucket_id = 'trip-memories'
      and (storage.foldername(o.name))[1] = d.id::text
    returning 1
  ), deleted as (
    delete from public.itinerary_trips t
    using to_delete d
    where t.id = d.id
    returning 1
  )
  select count(*)::integer into removed_count from deleted;

  return coalesce(removed_count, 0);
exception when undefined_table then
  return 0;
end;
$$;

grant execute on function public.cleanup_duplicate_empty_itinerary_starters() to authenticated;

create or replace function public.cleanup_my_orphaned_itinerary_storage()
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  removed_count integer := 0;
begin
  if auth.uid() is null then
    return 0;
  end if;

  -- Clean old memory photo objects for this user where the trip no longer exists.
  with deleted as (
    delete from storage.objects o
    where o.bucket_id = 'trip-memories'
      and (storage.foldername(o.name))[2] = auth.uid()::text
      and not exists (
        select 1 from public.itinerary_trips t
        where t.id::text = (storage.foldername(o.name))[1]
      )
    returning 1
  )
  select count(*)::integer into removed_count from deleted;

  return coalesce(removed_count, 0);
exception when others then
  return 0;
end;
$$;

grant execute on function public.cleanup_my_orphaned_itinerary_storage() to authenticated;
