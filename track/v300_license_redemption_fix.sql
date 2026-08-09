
-- ============================================================
-- WeTrack V3.0 — License Redemption Stabilization
-- Run once after V2.9.8. Safe to run repeatedly.
--
-- Fixes:
--  * authoritative one-row-per-user entitlement redemption
--  * case/whitespace tolerant key matching
--  * no dependency on legacy itinerary_user_entitlements
--  * correct repeat redemption behavior
--  * RPC remains authoritative even if old schema.sql was rerun
-- ============================================================

begin;

create table if not exists public.wetrack_user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',
  active boolean not null default false,
  source text not null default 'manual',
  license_key text,
  expires_at timestamptz,
  events_per_day integer not null default 5,
  max_trips integer not null default 1,
  memory_limit_per_trip integer not null default 0,
  enable_maps boolean not null default false,
  enable_memories boolean not null default false,
  enable_shopping_lists boolean not null default false,
  enable_recaps boolean not null default false,
  storekit_product_ids text[] not null default '{}'::text[],
  storekit_last_transaction_id text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wetrack_license_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email_snapshot text,
  event_type text not null,
  source text,
  license_key text,
  entitlement_snapshot jsonb,
  created_at timestamptz not null default now()
);

alter table if exists public.itinerary_license_keys
  add column if not exists license_generation integer not null default 1;

-- Fast normalized lookup without changing the stored/displayed key.
create index if not exists idx_itinerary_license_keys_normalized
  on public.itinerary_license_keys ((upper(btrim(license_key))));

create or replace function public.get_itinerary_license_status()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v public.wetrack_user_entitlements%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object(
      'plan','free','active',false,'events_per_day',5,'max_trips',1,
      'memory_limit_per_trip',0,'enable_maps',false,'enable_memories',false,
      'enable_shopping_lists',false,'enable_recaps',false
    );
  end if;

  select * into v from public.wetrack_user_entitlements
  where user_id=auth.uid();

  if not found or not v.active or lower(v.plan) <> 'premium'
     or (v.expires_at is not null and v.expires_at <= now()) then
    return jsonb_build_object(
      'plan','free','active',false,'events_per_day',5,'max_trips',1,
      'memory_limit_per_trip',0,'enable_maps',false,'enable_memories',false,
      'enable_shopping_lists',false,'enable_recaps',false
    );
  end if;

  return jsonb_build_object(
    'plan','premium','active',true,
    'events_per_day',greatest(1,v.events_per_day),
    'max_trips',greatest(1,v.max_trips),
    'memory_limit_per_trip',greatest(0,v.memory_limit_per_trip),
    'enable_maps',v.enable_maps,
    'enable_memories',v.enable_memories,
    'enable_shopping_lists',v.enable_shopping_lists,
    'enable_recaps',v.enable_recaps,
    'expires_at',v.expires_at,
    'source',v.source
  );
end;
$$;
grant execute on function public.get_itinerary_license_status() to authenticated;

create or replace function public.get_itinerary_license_plan()
returns text
language sql
security definer
set search_path=public
as $$
  select case
    when coalesce((public.get_itinerary_license_status()->>'active')::boolean,false)
    then 'premium' else 'free'
  end
$$;
grant execute on function public.get_itinerary_license_plan() to authenticated;

create or replace function public.redeem_itinerary_license(p_license_key text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_key public.itinerary_license_keys%rowtype;
  v_clean text := upper(btrim(coalesce(p_license_key,'')));
  v_current public.wetrack_user_entitlements%rowtype;
  v_is_repeat boolean := false;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if v_clean='' then
    raise exception 'Enter a license key';
  end if;

  select * into v_key
  from public.itinerary_license_keys
  where upper(btrim(license_key)) = v_clean
    and active=true
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Invalid or inactive license key';
  end if;

  select * into v_current
  from public.wetrack_user_entitlements
  where user_id=auth.uid();

  v_is_repeat := found
    and lower(coalesce(v_current.source,''))='license_key'
    and upper(btrim(coalesce(v_current.license_key,'')))=v_clean;

  if coalesce(v_key.redemption_count,0) >= coalesce(v_key.max_redemptions,1)
     and not v_is_repeat then
    raise exception 'This license key has reached its redemption limit';
  end if;

  insert into public.wetrack_user_entitlements(
    user_id,plan,active,source,license_key,expires_at,
    events_per_day,max_trips,memory_limit_per_trip,
    enable_maps,enable_memories,enable_shopping_lists,enable_recaps,
    updated_at
  ) values(
    auth.uid(),'premium',true,'license_key',v_key.license_key,v_key.expires_at,
    coalesce(v_key.events_per_day,25),
    coalesce(v_key.max_trips,25),
    coalesce(v_key.memory_limit_per_trip,20),
    coalesce(v_key.enable_maps,true),
    coalesce(v_key.enable_memories,true),
    coalesce(v_key.enable_shopping_lists,true),
    coalesce(v_key.enable_recaps,true),
    now()
  )
  on conflict(user_id) do update set
    plan='premium',
    active=true,
    source='license_key',
    license_key=excluded.license_key,
    expires_at=excluded.expires_at,
    events_per_day=excluded.events_per_day,
    max_trips=excluded.max_trips,
    memory_limit_per_trip=excluded.memory_limit_per_trip,
    enable_maps=excluded.enable_maps,
    enable_memories=excluded.enable_memories,
    enable_shopping_lists=excluded.enable_shopping_lists,
    enable_recaps=excluded.enable_recaps,
    updated_at=now();

  if not v_is_repeat then
    update public.itinerary_license_keys
    set redemption_count=coalesce(redemption_count,0)+1
    where id=v_key.id;
  end if;

  select email into v_email from auth.users where id=auth.uid();

  insert into public.wetrack_license_history(
    user_id,email_snapshot,event_type,source,license_key,entitlement_snapshot
  ) values(
    auth.uid(),v_email,
    case when v_is_repeat then 'redeem_refresh' else 'redeem' end,
    'license_key',v_key.license_key,
    public.get_itinerary_license_status()
  );

  return public.get_itinerary_license_status();
end;
$$;
grant execute on function public.redeem_itinerary_license(text) to authenticated;

commit;
notify pgrst,'reload schema';
