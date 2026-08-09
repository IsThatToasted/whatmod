
-- ============================================================
-- WeTrack V2.9.6 Licensing Consistency + Performance Repair
-- Safe to run repeatedly.
--
-- IMPORTANT:
-- This does NOT wipe keys automatically.
-- Run OPTIONAL_V296_RESET_OLD_LICENSE_KEYS.sql only when you are
-- ready to invalidate development-era keys.
-- ============================================================

alter table if exists public.itinerary_license_keys
  add column if not exists license_generation integer not null default 1;

-- All newly-created keys from the updated admin tool use generation 2.
-- Status is aggregated across every currently active entitlement. This fixes
-- users with several historical keys where a newer/older row could randomly
-- appear to remove Maps or another Premium feature.
create or replace function public.get_itinerary_license_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_has_premium boolean := false;
  v_events integer := 5;
  v_trips integer := 1;
  v_memories integer := 0;
  v_maps boolean := false;
  v_memory_feature boolean := false;
  v_shop boolean := false;
  v_recaps boolean := false;
  v_exp timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object(
      'plan','free','active',false,'events_per_day',5,'max_trips',1,
      'memory_limit_per_trip',0,'enable_maps',false,'enable_memories',false,
      'enable_shopping_lists',false,'enable_recaps',false
    );
  end if;

  select
    count(*) filter (where plan='premium') > 0,
    coalesce(max(events_per_day) filter (where plan='premium'),25),
    coalesce(max(max_trips) filter (where plan='premium'),25),
    coalesce(max(memory_limit_per_trip) filter (where plan='premium'),20),
    coalesce(bool_or(coalesce(enable_maps,true)) filter (where plan='premium'),false),
    coalesce(bool_or(coalesce(enable_memories,true)) filter (where plan='premium'),false),
    coalesce(bool_or(coalesce(enable_shopping_lists,true)) filter (where plan='premium'),false),
    coalesce(bool_or(coalesce(enable_recaps,true)) filter (where plan='premium'),false),
    max(expires_at) filter (where plan='premium')
  into v_has_premium,v_events,v_trips,v_memories,v_maps,v_memory_feature,v_shop,v_recaps,v_exp
  from public.itinerary_user_entitlements
  where user_id=v_uid
    and active=true
    and (expires_at is null or expires_at > now());

  if not v_has_premium then
    return jsonb_build_object(
      'plan','free','active',false,'events_per_day',5,'max_trips',1,
      'memory_limit_per_trip',0,'enable_maps',false,'enable_memories',false,
      'enable_shopping_lists',false,'enable_recaps',false
    );
  end if;

  return jsonb_build_object(
    'plan','premium','active',true,
    'events_per_day',greatest(1,v_events),
    'max_trips',greatest(1,v_trips),
    'memory_limit_per_trip',greatest(0,v_memories),
    'enable_maps',v_maps,
    'enable_memories',v_memory_feature,
    'enable_shopping_lists',v_shop,
    'enable_recaps',v_recaps,
    'expires_at',v_exp
  );
end;
$$;
grant execute on function public.get_itinerary_license_status() to authenticated;

-- Legacy plan endpoint now delegates to the same authoritative status.
create or replace function public.get_itinerary_license_plan()
returns text
language sql
security definer
set search_path=public
as $$
  select case when coalesce((public.get_itinerary_license_status()->>'active')::boolean,false)
              then 'premium' else 'free' end;
$$;
grant execute on function public.get_itinerary_license_plan() to authenticated;

create index if not exists idx_itinerary_entitlements_user_active
  on public.itinerary_user_entitlements(user_id,active,plan);

notify pgrst, 'reload schema';
