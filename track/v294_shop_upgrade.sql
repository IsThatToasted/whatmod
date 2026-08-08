

-- ============================================================
-- WeTrack V2.9.4 Shop / subscription entitlement extension
-- Safe to run repeatedly. Does not remove existing licenses.
-- ============================================================
alter table if exists public.itinerary_user_entitlements
  add column if not exists memory_limit_per_trip integer,
  add column if not exists storekit_product_ids text[] default '{}'::text[],
  add column if not exists storekit_last_transaction_id text;

-- StoreKit purchase journal. Client entries originate only after StoreKit 2 verifies
-- the transaction inside the native iOS wrapper. For App Store public launch, pair
-- this with App Store Server Notifications / server-side transaction verification.
create table if not exists public.wetrack_storekit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  transaction_id text not null unique,
  original_transaction_id text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.wetrack_storekit_purchases enable row level security;
grant select on public.wetrack_storekit_purchases to authenticated;
drop policy if exists "users read own StoreKit purchases" on public.wetrack_storekit_purchases;
create policy "users read own StoreKit purchases" on public.wetrack_storekit_purchases for select using (user_id=auth.uid());

create or replace function public.record_wetrack_storekit_purchase(
  p_product_id text,
  p_transaction_id text,
  p_original_transaction_id text default null,
  p_expires_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_extra integer := 0;
  v_base boolean := false;
  v_products text[];
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

  insert into public.wetrack_storekit_purchases(user_id,product_id,transaction_id,original_transaction_id,expires_at)
  values(v_uid,p_product_id,p_transaction_id,p_original_transaction_id,p_expires_at)
  on conflict(transaction_id) do update set expires_at=excluded.expires_at,updated_at=now();

  select coalesce(storekit_product_ids,'{}'::text[]) into v_products
  from public.itinerary_user_entitlements
  where user_id=v_uid and active=true order by updated_at desc nulls last, created_at desc limit 1;
  v_products := coalesce(v_products,'{}'::text[]);
  if not (p_product_id=any(v_products)) then v_products:=array_append(v_products,p_product_id); end if;

  if v_base then
    insert into public.itinerary_user_entitlements(
      user_id,plan,active,source,license_key,events_per_day,max_trips,
      enable_maps,enable_memories,enable_shopping_lists,enable_recaps,
      memory_limit_per_trip,storekit_product_ids,storekit_last_transaction_id,expires_at
    ) values(
      v_uid,'premium',true,'storekit','storekit:premium',25,25,true,true,true,true,
      20,v_products,p_transaction_id,p_expires_at
    ) on conflict(user_id,source,license_key) do update set
      plan='premium',active=true,events_per_day=25,max_trips=25,
      enable_maps=true,enable_memories=true,enable_shopping_lists=true,enable_recaps=true,
      memory_limit_per_trip=greatest(coalesce(public.itinerary_user_entitlements.memory_limit_per_trip,20),20),
      storekit_product_ids=v_products,storekit_last_transaction_id=p_transaction_id,
      expires_at=p_expires_at,updated_at=now();
  else
    if not exists(select 1 from public.itinerary_user_entitlements where user_id=v_uid and active=true and plan='premium') then
      raise exception 'WeTrack Premium is required before adding memory capacity';
    end if;
    update public.itinerary_user_entitlements
    set memory_limit_per_trip=20+v_extra,
        storekit_product_ids=v_products,
        storekit_last_transaction_id=p_transaction_id,
        updated_at=now()
    where id=(select id from public.itinerary_user_entitlements where user_id=v_uid and active=true and plan='premium' order by updated_at desc nulls last,created_at desc limit 1);
  end if;
  return public.get_itinerary_license_status();
end $$;
grant execute on function public.record_wetrack_storekit_purchase(text,text,text,timestamptz) to authenticated;

-- Replace status RPC with memory capacity included. Existing feature flags and licenses remain supported.
create or replace function public.get_itinerary_license_status()
returns jsonb language plpgsql security definer set search_path=public
as $$
declare v_ent public.itinerary_user_entitlements%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('plan','free','active',false,'events_per_day',5,'max_trips',1,
      'enable_maps',false,'enable_memories',false,'enable_shopping_lists',false,'enable_recaps',false,'memory_limit_per_trip',0);
  end if;
  select * into v_ent from public.itinerary_user_entitlements e
  where e.user_id=auth.uid() and e.active=true and (e.expires_at is null or e.expires_at>now())
  order by case when e.plan='premium' then 0 else 1 end,e.updated_at desc nulls last,e.created_at desc limit 1;
  if not found or v_ent.plan<>'premium' then
    return jsonb_build_object('plan','free','active',false,'events_per_day',5,'max_trips',1,
      'enable_maps',false,'enable_memories',false,'enable_shopping_lists',false,'enable_recaps',false,'memory_limit_per_trip',0);
  end if;
  return jsonb_build_object(
    'plan','premium','active',true,
    'events_per_day',coalesce(v_ent.events_per_day,25),'max_trips',coalesce(v_ent.max_trips,25),
    'enable_maps',coalesce(v_ent.enable_maps,true),'enable_memories',coalesce(v_ent.enable_memories,true),
    'enable_shopping_lists',coalesce(v_ent.enable_shopping_lists,true),'enable_recaps',coalesce(v_ent.enable_recaps,true),
    'memory_limit_per_trip',coalesce(v_ent.memory_limit_per_trip,20),
    'storekit_product_ids',coalesce(v_ent.storekit_product_ids,'{}'::text[])
  );
end $$;
grant execute on function public.get_itinerary_license_status() to authenticated;
