-- ============================================================
-- WeTrack V2.9.3 SAFE RECOVERY
-- Purpose: restore onboarding persistence + packing race protection
-- WITHOUT changing/deleting trips, licenses, entitlements, Fun Ideas,
-- memories, shopping lists, event permissions, or existing packing rows.
-- Safe to run multiple times.
-- ============================================================

begin;


-- Undo indexes from the abandoned V2.9.x migrations that assumed a different schema.
-- Both are safe to drop and no data is removed.
drop index if exists public.itinerary_user_profiles_user_id_uidx;
drop index if exists public.itinerary_packing_starter_unique_idx;

-- 1) Dedicated account-level profile. Do NOT reuse legacy itinerary_user_profiles;
-- some deployments correctly have that table scoped by trip_id.
create table if not exists public.wetrack_account_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  trip_role text default 'Traveler',
  favorite_foods text,
  favorite_activities text,
  personal_interests text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wetrack_account_profiles enable row level security;
grant select, insert, update on public.wetrack_account_profiles to authenticated;

drop policy if exists "users read own wetrack account profile" on public.wetrack_account_profiles;
create policy "users read own wetrack account profile"
on public.wetrack_account_profiles for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "users create own wetrack account profile" on public.wetrack_account_profiles;
create policy "users create own wetrack account profile"
on public.wetrack_account_profiles for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "users update own wetrack account profile" on public.wetrack_account_profiles;
create policy "users update own wetrack account profile"
on public.wetrack_account_profiles for update to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.itinerary_trip_members
  add column if not exists onboarding_completed boolean not null default false;

-- Backfill users who previously completed onboarding on any trip.
insert into public.wetrack_account_profiles(
  user_id, display_name, trip_role, favorite_foods,
  favorite_activities, personal_interests, onboarding_completed, updated_at
)
select distinct on (m.user_id)
  m.user_id,
  m.display_name,
  coalesce(nullif(m.trip_role,''),'Traveler'),
  m.favorite_foods,
  m.favorite_activities,
  m.personal_interests,
  true,
  now()
from public.itinerary_trip_members m
where coalesce(m.onboarding_completed,false) = true
order by m.user_id, m.created_at desc
on conflict (user_id) do update set
  display_name = coalesce(nullif(excluded.display_name,''), public.wetrack_account_profiles.display_name),
  trip_role = coalesce(nullif(excluded.trip_role,''), public.wetrack_account_profiles.trip_role),
  favorite_foods = coalesce(nullif(excluded.favorite_foods,''), public.wetrack_account_profiles.favorite_foods),
  favorite_activities = coalesce(nullif(excluded.favorite_activities,''), public.wetrack_account_profiles.favorite_activities),
  personal_interests = coalesce(nullif(excluded.personal_interests,''), public.wetrack_account_profiles.personal_interests),
  onboarding_completed = true,
  updated_at = now();

-- 2) Transaction-safe starter packing. This NEVER deletes or changes existing rows.
create or replace function public.ensure_itinerary_starter_packing(target_trip_id uuid)
returns setof public.itinerary_packing_items
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (
    select 1 from public.itinerary_trip_members m
    where m.trip_id=target_trip_id and m.user_id=auth.uid() and m.role in ('owner','editor')
  ) then raise exception 'Not authorized'; end if;

  perform pg_advisory_xact_lock(hashtext(target_trip_id::text || ':' || auth.uid()::text || ':packing'));

  -- Seed only if the user truly has NO packing rows for this trip.
  if not exists (
    select 1 from public.itinerary_packing_items p
    where p.trip_id=target_trip_id and p.user_id=auth.uid()
  ) then
    insert into public.itinerary_packing_items(trip_id,user_id,label,packed,sort_order)
    values
      (target_trip_id,auth.uid(),'Clothing',false,0),
      (target_trip_id,auth.uid(),'Toiletries',false,1),
      (target_trip_id,auth.uid(),'Chargers',false,2),
      (target_trip_id,auth.uid(),'Medications',false,3),
      (target_trip_id,auth.uid(),'Swimwear',false,4),
      (target_trip_id,auth.uid(),'Comfort items',false,5),
      (target_trip_id,auth.uid(),'Snacks',false,6),
      (target_trip_id,auth.uid(),'Travel documents',false,7);
  end if;

  return query
    select p.* from public.itinerary_packing_items p
    where p.trip_id=target_trip_id and p.user_id=auth.uid()
    order by p.sort_order,p.created_at;
end;
$$;
grant execute on function public.ensure_itinerary_starter_packing(uuid) to authenticated;

-- 3) Restore the license-status RPC definition only. This does NOT alter entitlement rows.
alter table if exists public.itinerary_user_entitlements
  add column if not exists events_per_day int,
  add column if not exists max_trips int,
  add column if not exists enable_maps boolean,
  add column if not exists enable_memories boolean,
  add column if not exists enable_shopping_lists boolean,
  add column if not exists enable_recaps boolean,
  add column if not exists admin_notes text;

create or replace function public.get_itinerary_license_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_ent public.itinerary_user_entitlements%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('plan','free','active',false,'events_per_day',5,'max_trips',1,
      'enable_maps',false,'enable_memories',false,'enable_shopping_lists',false,'enable_recaps',false);
  end if;

  select * into v_ent from public.itinerary_user_entitlements e
  where e.user_id=auth.uid() and e.active=true
    and (e.expires_at is null or e.expires_at > now())
  order by case when e.plan='premium' then 0 else 1 end,
    e.updated_at desc nulls last, e.created_at desc
  limit 1;

  if not found or v_ent.plan <> 'premium' then
    return jsonb_build_object('plan','free','active',false,'events_per_day',5,'max_trips',1,
      'enable_maps',false,'enable_memories',false,'enable_shopping_lists',false,'enable_recaps',false);
  end if;

  return jsonb_build_object('plan','premium','active',true,
    'events_per_day',coalesce(v_ent.events_per_day,25),
    'max_trips',coalesce(v_ent.max_trips,25),
    'enable_maps',coalesce(v_ent.enable_maps,true),
    'enable_memories',coalesce(v_ent.enable_memories,true),
    'enable_shopping_lists',coalesce(v_ent.enable_shopping_lists,true),
    'enable_recaps',coalesce(v_ent.enable_recaps,true),
    'expires_at',v_ent.expires_at);
end;
$$;
grant execute on function public.get_itinerary_license_status() to authenticated;

commit;
notify pgrst, 'reload schema';

-- READ-ONLY verification results:
select 'premium_entitlements' as check_name, count(*) as rows
from public.itinerary_user_entitlements
where active=true and plan='premium' and (expires_at is null or expires_at > now());

select 'account_onboarding_profiles' as check_name, count(*) as rows
from public.wetrack_account_profiles where onboarding_completed=true;

select 'packing_rows_total' as check_name, count(*) as rows
from public.itinerary_packing_items;
