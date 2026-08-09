-- ============================================================
-- WeTrack V2.9.5 Licensing Admin Upgrade
-- Adds per-license memory limits and keeps redeemed entitlements
-- aligned with each key's configurable limits.
-- Safe to run repeatedly.
-- ============================================================

alter table if exists public.itinerary_license_keys
  add column if not exists memory_limit_per_trip integer default 20;

update public.itinerary_license_keys
set memory_limit_per_trip = 20
where memory_limit_per_trip is null;

-- Latest license redemption function: copies every key-level entitlement,
-- including memory capacity, into the redeemed user entitlement.
create or replace function public.redeem_itinerary_license(p_license_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.itinerary_license_keys%rowtype;
  v_clean text := trim(p_license_key);
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into v_key
  from public.itinerary_license_keys
  where license_key = v_clean
    and active = true
    and (expires_at is null or expires_at > now())
  for update;

  if not found then
    raise exception 'Invalid or inactive license key';
  end if;

  if v_key.redemption_count >= v_key.max_redemptions then
    -- Permit a user who already redeemed this exact key to refresh their entitlement
    -- without consuming another redemption.
    if not exists (
      select 1 from public.itinerary_user_entitlements e
      where e.user_id = auth.uid()
        and e.source = 'license_key'
        and e.license_key = v_clean
    ) then
      raise exception 'This license key has already reached its redemption limit';
    end if;
  end if;

  insert into public.itinerary_user_entitlements(
    user_id, plan, active, source, license_key, expires_at,
    events_per_day, max_trips, memory_limit_per_trip,
    enable_maps, enable_memories, enable_shopping_lists, enable_recaps
  ) values (
    auth.uid(), v_key.plan, true, 'license_key', v_clean, v_key.expires_at,
    coalesce(v_key.events_per_day,25), coalesce(v_key.max_trips,25), coalesce(v_key.memory_limit_per_trip,20),
    coalesce(v_key.enable_maps,true), coalesce(v_key.enable_memories,true),
    coalesce(v_key.enable_shopping_lists,true), coalesce(v_key.enable_recaps,true)
  )
  on conflict (user_id, source, license_key) do update set
    active = true,
    plan = excluded.plan,
    expires_at = excluded.expires_at,
    events_per_day = excluded.events_per_day,
    max_trips = excluded.max_trips,
    memory_limit_per_trip = excluded.memory_limit_per_trip,
    enable_maps = excluded.enable_maps,
    enable_memories = excluded.enable_memories,
    enable_shopping_lists = excluded.enable_shopping_lists,
    enable_recaps = excluded.enable_recaps,
    updated_at = now();

  -- Count a redemption only the first time this user/key pair is created.
  if not exists (
    select 1 from public.itinerary_user_entitlements e
    where e.user_id = auth.uid()
      and e.source = 'license_key'
      and e.license_key = v_clean
      and e.created_at < now() - interval '1 second'
  ) then
    update public.itinerary_license_keys
    set redemption_count = least(redemption_count + 1, max_redemptions)
    where id = v_key.id;
  end if;

  return public.get_itinerary_license_status();
end;
$$;

grant execute on function public.redeem_itinerary_license(text) to authenticated;

-- Replace the SQL-editor admin helper with memory capacity support.
create or replace function public.admin_set_itinerary_entitlement_by_email(
  p_email text,
  p_plan text default 'premium',
  p_active boolean default true,
  p_events_per_day int default 25,
  p_max_trips int default 25,
  p_memory_limit_per_trip int default 20,
  p_enable_maps boolean default true,
  p_enable_memories boolean default true,
  p_enable_shopping_lists boolean default true,
  p_enable_recaps boolean default true,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(p_email) limit 1;
  if v_user is null then
    raise exception 'No auth user found for %', p_email;
  end if;

  insert into public.itinerary_user_entitlements(
    user_id, plan, active, source, license_key,
    events_per_day, max_trips, memory_limit_per_trip,
    enable_maps, enable_memories, enable_shopping_lists, enable_recaps, admin_notes
  ) values (
    v_user, case when p_plan = 'premium' then 'premium' else 'free' end, p_active,
    'manual', 'manual:' || lower(p_email),
    greatest(1,p_events_per_day), greatest(1,p_max_trips), greatest(0,p_memory_limit_per_trip),
    p_enable_maps, p_enable_memories, p_enable_shopping_lists, p_enable_recaps, p_admin_notes
  )
  on conflict (user_id, source, license_key) do update set
    plan = excluded.plan,
    active = excluded.active,
    events_per_day = excluded.events_per_day,
    max_trips = excluded.max_trips,
    memory_limit_per_trip = excluded.memory_limit_per_trip,
    enable_maps = excluded.enable_maps,
    enable_memories = excluded.enable_memories,
    enable_shopping_lists = excluded.enable_shopping_lists,
    enable_recaps = excluded.enable_recaps,
    admin_notes = excluded.admin_notes,
    updated_at = now();

  return jsonb_build_object(
    'user_id', v_user,
    'email', p_email,
    'updated', true,
    'memory_limit_per_trip', greatest(0,p_memory_limit_per_trip)
  );
end;
$$;

-- Deliberately not granted to authenticated users. This helper is intended for
-- the Supabase SQL editor / service-role admin tool only.

-- Example customizable key:
-- insert into public.itinerary_license_keys(
--   license_key,max_redemptions,events_per_day,max_trips,memory_limit_per_trip,
--   enable_maps,enable_memories,enable_shopping_lists,enable_recaps,active
-- ) values ('WETRACK-EXAMPLE-1234',1,25,25,60,true,true,true,true,true);
