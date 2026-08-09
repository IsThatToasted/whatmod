
-- ============================================================
-- WeTrack V2.9.8 — Authoritative Current Entitlements
-- One current entitlement row per user.
--
-- Existing itinerary_user_entitlements rows are retained as legacy history
-- but are no longer used for feature gating after this migration.
-- Safe to run repeatedly.
-- ============================================================

begin;

alter table if exists public.itinerary_license_keys
  add column if not exists license_generation integer not null default 1;

create table if not exists public.wetrack_user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','premium')),
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

alter table public.wetrack_user_entitlements enable row level security;
alter table public.wetrack_license_history enable row level security;

grant select on public.wetrack_user_entitlements to authenticated;

drop policy if exists "users can view own current entitlement" on public.wetrack_user_entitlements;
create policy "users can view own current entitlement"
  on public.wetrack_user_entitlements
  for select
  using (user_id = auth.uid());

-- History is intentionally admin/service-role only.
drop policy if exists "license history hidden from clients" on public.wetrack_license_history;
create policy "license history hidden from clients"
  on public.wetrack_license_history
  for select
  using (false);

-- ------------------------------------------------------------
-- One-time import from the legacy multi-row entitlement table.
-- We aggregate all currently-valid Premium rows so no feature can be lost
-- during migration, then choose the newest active row only for source/key metadata.
-- ------------------------------------------------------------
do $migration$
begin
  if to_regclass('public.itinerary_user_entitlements') is not null then
    insert into public.wetrack_user_entitlements (
      user_id, plan, active, source, license_key, expires_at,
      events_per_day, max_trips, memory_limit_per_trip,
      enable_maps, enable_memories, enable_shopping_lists, enable_recaps,
      storekit_product_ids, storekit_last_transaction_id, admin_notes, updated_at
    )
    select
      a.user_id,
      'premium',
      true,
      coalesce(latest.source,'migration'),
      latest.license_key,
      a.expires_at,
      greatest(1,a.events_per_day),
      greatest(1,a.max_trips),
      greatest(0,a.memory_limit_per_trip),
      a.enable_maps,
      a.enable_memories,
      a.enable_shopping_lists,
      a.enable_recaps,
      coalesce(latest.storekit_product_ids,'{}'::text[]),
      latest.storekit_last_transaction_id,
      latest.admin_notes,
      now()
    from (
      select
        e.user_id,
        max(coalesce(e.events_per_day,25)) as events_per_day,
        max(coalesce(e.max_trips,25)) as max_trips,
        max(coalesce(e.memory_limit_per_trip,20)) as memory_limit_per_trip,
        bool_or(coalesce(e.enable_maps,true)) as enable_maps,
        bool_or(coalesce(e.enable_memories,true)) as enable_memories,
        bool_or(coalesce(e.enable_shopping_lists,true)) as enable_shopping_lists,
        bool_or(coalesce(e.enable_recaps,true)) as enable_recaps,
        max(e.expires_at) as expires_at
      from public.itinerary_user_entitlements e
      where e.active=true
        and e.plan='premium'
        and (e.expires_at is null or e.expires_at > now())
      group by e.user_id
    ) a
    left join lateral (
      select e.source,e.license_key,e.storekit_product_ids,
             e.storekit_last_transaction_id,e.admin_notes
      from public.itinerary_user_entitlements e
      where e.user_id=a.user_id
        and e.active=true
        and e.plan='premium'
        and (e.expires_at is null or e.expires_at > now())
      order by e.updated_at desc nulls last,e.created_at desc
      limit 1
    ) latest on true
    on conflict(user_id) do update set
      -- Never downgrade an already-created current entitlement during a rerun.
      plan = case when public.wetrack_user_entitlements.plan='premium' then 'premium' else excluded.plan end,
      active = public.wetrack_user_entitlements.active or excluded.active,
      events_per_day = greatest(public.wetrack_user_entitlements.events_per_day,excluded.events_per_day),
      max_trips = greatest(public.wetrack_user_entitlements.max_trips,excluded.max_trips),
      memory_limit_per_trip = greatest(public.wetrack_user_entitlements.memory_limit_per_trip,excluded.memory_limit_per_trip),
      enable_maps = public.wetrack_user_entitlements.enable_maps or excluded.enable_maps,
      enable_memories = public.wetrack_user_entitlements.enable_memories or excluded.enable_memories,
      enable_shopping_lists = public.wetrack_user_entitlements.enable_shopping_lists or excluded.enable_shopping_lists,
      enable_recaps = public.wetrack_user_entitlements.enable_recaps or excluded.enable_recaps,
      updated_at = now();
  end if;
end
$migration$;

-- ------------------------------------------------------------
-- Single authoritative status RPC used by PC, mobile web and iOS WebView.
-- ------------------------------------------------------------
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

  select * into v
  from public.wetrack_user_entitlements
  where user_id=auth.uid()
  limit 1;

  if not found
     or not v.active
     or v.plan <> 'premium'
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
  end;
$$;
grant execute on function public.get_itinerary_license_plan() to authenticated;

-- ------------------------------------------------------------
-- Redeeming a key now REPLACES the user's current license entitlement.
-- Old key use becomes history, never a competing entitlement row.
-- ------------------------------------------------------------
create or replace function public.redeem_itinerary_license(p_license_key text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_key public.itinerary_license_keys%rowtype;
  v_clean text := trim(p_license_key);
  v_already_redeemed boolean := false;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select * into v_key
  from public.itinerary_license_keys
  where license_key=v_clean
    and active=true
    and (expires_at is null or expires_at > now())
  for update;

  if not found then raise exception 'Invalid or inactive license key'; end if;

  select exists(
    select 1 from public.wetrack_license_history h
    where h.user_id=auth.uid()
      and h.event_type='redeem'
      and h.license_key=v_clean
  ) or exists(
    select 1 from public.itinerary_user_entitlements e
    where e.user_id=auth.uid()
      and e.source='license_key'
      and e.license_key=v_clean
  ) into v_already_redeemed;

  if v_key.redemption_count >= v_key.max_redemptions and not v_already_redeemed then
    raise exception 'This license key has reached its redemption limit';
  end if;

  insert into public.wetrack_user_entitlements(
    user_id,plan,active,source,license_key,expires_at,
    events_per_day,max_trips,memory_limit_per_trip,
    enable_maps,enable_memories,enable_shopping_lists,enable_recaps,
    updated_at
  ) values(
    auth.uid(),'premium',true,'license_key',v_clean,v_key.expires_at,
    coalesce(v_key.events_per_day,25),coalesce(v_key.max_trips,25),
    coalesce(v_key.memory_limit_per_trip,20),
    coalesce(v_key.enable_maps,true),coalesce(v_key.enable_memories,true),
    coalesce(v_key.enable_shopping_lists,true),coalesce(v_key.enable_recaps,true),
    now()
  )
  on conflict(user_id) do update set
    plan='premium',active=true,source='license_key',license_key=excluded.license_key,
    expires_at=excluded.expires_at,
    events_per_day=excluded.events_per_day,max_trips=excluded.max_trips,
    memory_limit_per_trip=excluded.memory_limit_per_trip,
    enable_maps=excluded.enable_maps,enable_memories=excluded.enable_memories,
    enable_shopping_lists=excluded.enable_shopping_lists,enable_recaps=excluded.enable_recaps,
    updated_at=now();

  if not v_already_redeemed then
    update public.itinerary_license_keys
    set redemption_count=least(redemption_count+1,max_redemptions)
    where id=v_key.id;
  end if;

  select email into v_email from auth.users where id=auth.uid();

  insert into public.wetrack_license_history(
    user_id,email_snapshot,event_type,source,license_key,entitlement_snapshot
  ) values(
    auth.uid(),v_email,'redeem','license_key',v_clean,
    public.get_itinerary_license_status()
  );

  return public.get_itinerary_license_status();
end;
$$;
grant execute on function public.redeem_itinerary_license(text) to authenticated;

-- ------------------------------------------------------------
-- Admin helper updates exactly ONE current row for the user.
-- ------------------------------------------------------------
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
set search_path=public,auth
as $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email)=lower(trim(p_email)) limit 1;
  if v_user is null then raise exception 'No auth user found for %',p_email; end if;

  insert into public.wetrack_user_entitlements(
    user_id,plan,active,source,license_key,
    events_per_day,max_trips,memory_limit_per_trip,
    enable_maps,enable_memories,enable_shopping_lists,enable_recaps,
    admin_notes,updated_at
  ) values(
    v_user,case when p_plan='premium' then 'premium' else 'free' end,p_active,
    'manual',null,
    greatest(1,p_events_per_day),greatest(1,p_max_trips),greatest(0,p_memory_limit_per_trip),
    p_enable_maps,p_enable_memories,p_enable_shopping_lists,p_enable_recaps,
    p_admin_notes,now()
  )
  on conflict(user_id) do update set
    plan=excluded.plan,active=excluded.active,source='manual',license_key=null,
    events_per_day=excluded.events_per_day,max_trips=excluded.max_trips,
    memory_limit_per_trip=excluded.memory_limit_per_trip,
    enable_maps=excluded.enable_maps,enable_memories=excluded.enable_memories,
    enable_shopping_lists=excluded.enable_shopping_lists,enable_recaps=excluded.enable_recaps,
    admin_notes=excluded.admin_notes,updated_at=now();

  insert into public.wetrack_license_history(
    user_id,email_snapshot,event_type,source,license_key,entitlement_snapshot
  )
  select v_user,p_email,'admin_update','manual',null,to_jsonb(e)
  from public.wetrack_user_entitlements e where e.user_id=v_user;

  return jsonb_build_object('user_id',v_user,'email',p_email,'updated',true);
end;
$$;

-- ------------------------------------------------------------
-- StoreKit also updates the same current row.
-- ------------------------------------------------------------
create or replace function public.record_wetrack_storekit_purchase(
  p_product_id text,
  p_transaction_id text,
  p_original_transaction_id text default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_extra integer := 0;
  v_base boolean := false;
  v_products text[] := '{}'::text[];
  v_email text;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  if coalesce(trim(p_transaction_id),'')='' then raise exception 'Missing StoreKit transaction'; end if;

  v_base := p_product_id='com.wetrack.premium.monthly';
  v_extra := case p_product_id
    when 'com.wetrack.memories.plus20.monthly' then 20
    when 'com.wetrack.memories.plus40.monthly' then 40
    when 'com.wetrack.memories.plus60.monthly' then 60
    when 'com.wetrack.memories.plus80.monthly' then 80
    when 'com.wetrack.memories.plus100.monthly' then 100
    else 0 end;

  if not v_base and v_extra=0 then raise exception 'Unknown WeTrack product'; end if;

  insert into public.wetrack_storekit_purchases(
    user_id,product_id,transaction_id,original_transaction_id,expires_at
  ) values(v_uid,p_product_id,p_transaction_id,p_original_transaction_id,p_expires_at)
  on conflict(transaction_id) do update
    set expires_at=excluded.expires_at,updated_at=now();

  select coalesce(storekit_product_ids,'{}'::text[]) into v_products
  from public.wetrack_user_entitlements where user_id=v_uid;
  v_products := coalesce(v_products,'{}'::text[]);
  if not (p_product_id=any(v_products)) then v_products:=array_append(v_products,p_product_id); end if;

  if v_base then
    insert into public.wetrack_user_entitlements(
      user_id,plan,active,source,license_key,expires_at,
      events_per_day,max_trips,memory_limit_per_trip,
      enable_maps,enable_memories,enable_shopping_lists,enable_recaps,
      storekit_product_ids,storekit_last_transaction_id,updated_at
    ) values(
      v_uid,'premium',true,'storekit',null,p_expires_at,
      25,25,20,true,true,true,true,
      v_products,p_transaction_id,now()
    )
    on conflict(user_id) do update set
      plan='premium',active=true,source='storekit',license_key=null,
      expires_at=excluded.expires_at,
      events_per_day=greatest(public.wetrack_user_entitlements.events_per_day,25),
      max_trips=greatest(public.wetrack_user_entitlements.max_trips,25),
      memory_limit_per_trip=greatest(public.wetrack_user_entitlements.memory_limit_per_trip,20),
      enable_maps=true,enable_memories=true,enable_shopping_lists=true,enable_recaps=true,
      storekit_product_ids=v_products,storekit_last_transaction_id=p_transaction_id,
      updated_at=now();
  else
    if not exists(
      select 1 from public.wetrack_user_entitlements
      where user_id=v_uid and active=true and plan='premium'
        and (expires_at is null or expires_at>now())
    ) then
      raise exception 'WeTrack Premium is required before adding memory capacity';
    end if;

    update public.wetrack_user_entitlements
    set memory_limit_per_trip=greatest(memory_limit_per_trip,20+v_extra),
        storekit_product_ids=v_products,
        storekit_last_transaction_id=p_transaction_id,
        updated_at=now()
    where user_id=v_uid;
  end if;

  select email into v_email from auth.users where id=v_uid;
  insert into public.wetrack_license_history(
    user_id,email_snapshot,event_type,source,license_key,entitlement_snapshot
  ) values(v_uid,v_email,'storekit_purchase','storekit',null,public.get_itinerary_license_status());

  return public.get_itinerary_license_status();
end;
$$;
grant execute on function public.record_wetrack_storekit_purchase(text,text,text,timestamptz) to authenticated;

create index if not exists idx_wetrack_current_entitlements_active
  on public.wetrack_user_entitlements(active,plan);
create index if not exists idx_wetrack_license_history_user_created
  on public.wetrack_license_history(user_id,created_at desc);

commit;
notify pgrst,'reload schema';
