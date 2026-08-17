-- Afterglow distribution migration v3
-- Adds privacy-safe device-location distance, Afterglow+ 30-day entitlements,
-- and keeps all wallet/premium writes server-authoritative.
-- Safe to run repeatedly after supabase-production-hardening.sql v2.1.

begin;

create or replace function public.fv_json_number(value text)
returns double precision
language sql
immutable
set search_path = public
as $$
  select case
    when value is not null and value ~ '^-?[0-9]+([.][0-9]+)?$' then value::double precision
    else null
  end;
$$;

revoke all on function public.fv_json_number(text) from public, anon, authenticated;

create table if not exists public.fv_premium_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  premium_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fv_premium_entitlements enable row level security;

drop policy if exists "Users can read own Afterglow premium entitlement" on public.fv_premium_entitlements;
drop policy if exists "Owner can read Afterglow premium entitlements" on public.fv_premium_entitlements;
create policy "Users can read own Afterglow premium entitlement"
  on public.fv_premium_entitlements for select to authenticated
  using (auth.uid() = user_id);
create policy "Owner can read Afterglow premium entitlements"
  on public.fv_premium_entitlements for select to authenticated
  using (public.fv_is_admin());

grant select on public.fv_premium_entitlements to authenticated;
revoke insert, update, delete on public.fv_premium_entitlements from authenticated, anon;

create or replace function public.fv_economy_json(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'wallet',coalesce((select to_jsonb(w) from public.fv_wallets w where w.user_id=p_uid),'{}'::jsonb),
    'claim_status',coalesce((
      select jsonb_build_object(
        'today',timezone(w.timezone,now())::date,
        'claimed_today',w.last_claim_date=timezone(w.timezone,now())::date,
        'timezone',w.timezone
      ) from public.fv_wallets w where w.user_id=p_uid
    ),'{}'::jsonb),
    'inventory',coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id',ui.item_id,'item_type',s.item_type,'item_value',s.item_value,
        'equipped',ui.equipped,'purchased_at',ui.purchased_at,'metadata',s.metadata
      ) order by ui.purchased_at)
      from public.fv_user_inventory ui join public.fv_shop_items s on s.item_id=ui.item_id
      where ui.user_id=p_uid
    ),'[]'::jsonb),
    'premium',coalesce((
      select jsonb_build_object(
        'active',e.premium_until > now(),
        'premium_until',e.premium_until,
        'updated_at',e.updated_at
      ) from public.fv_premium_entitlements e where e.user_id=p_uid
    ),jsonb_build_object('active',false,'premium_until',null))
  );
$$;

revoke all on function public.fv_economy_json(uuid) from public, anon, authenticated;

create or replace function public.fv_purchase_premium_30d(p_purchase_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_wallet public.fv_wallets%rowtype;
  v_cost integer := 2300;
  v_source text;
  v_until timestamptz;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  v_source := 'premium30:' || left(
    coalesce(nullif(regexp_replace(coalesce(p_purchase_key,''),'[^A-Za-z0-9:_-]','','g'),''),gen_random_uuid()::text),
    100
  );

  insert into public.fv_wallets(user_id,timezone) values(v_uid,'UTC') on conflict do nothing;
  select * into v_wallet from public.fv_wallets where user_id=v_uid for update;

  if exists(select 1 from public.fv_wallet_ledger where user_id=v_uid and source_key=v_source) then
    return jsonb_build_object('status','already_processed','cost',0,'economy',public.fv_economy_json(v_uid));
  end if;

  if v_wallet.glow_coins < v_cost then
    return jsonb_build_object(
      'status','insufficient','cost',v_cost,'needed',v_cost-v_wallet.glow_coins,
      'economy',public.fv_economy_json(v_uid)
    );
  end if;

  update public.fv_wallets
  set glow_coins=glow_coins-v_cost,
      lifetime_spent=lifetime_spent+v_cost,
      updated_at=now()
  where user_id=v_uid
  returning * into v_wallet;

  insert into public.fv_premium_entitlements(user_id,premium_until)
  values(v_uid,now()+interval '30 days')
  on conflict(user_id) do update set
    premium_until=greatest(public.fv_premium_entitlements.premium_until,now())+interval '30 days',
    updated_at=now()
  returning premium_until into v_until;

  insert into public.fv_wallet_ledger(user_id,amount,balance_after,entry_type,source_key,metadata)
  values(v_uid,-v_cost,v_wallet.glow_coins,'premium_pass',v_source,
    jsonb_build_object('days',30,'premium_until',v_until));

  return jsonb_build_object(
    'status','purchased','cost',v_cost,'premium_until',v_until,
    'economy',public.fv_economy_json(v_uid)
  );
end;
$$;

grant execute on function public.fv_purchase_premium_30d(text) to authenticated;
revoke all on function public.fv_purchase_premium_30d(text) from public, anon;

-- Directory output intentionally strips exact location coordinates. Distance is
-- calculated on the server and exposed only as an approximate whole-mile value.
-- Free members receive only a locked, non-identifying shell for profiles that
-- cannot be proven to be within 50 miles. This keeps the premium boundary on
-- the server rather than trusting browser JavaScript.
create or replace function public.fv_get_directory(p_limit integer default 80)
returns table(
  id uuid,
  user_id uuid,
  email text,
  profile jsonb,
  ratings jsonb,
  liked jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      coalesce(p.ratings,'{}'::jsonb) as ratings,
      public.fv_json_number(p.profile #>> '{location,lat}') as lat,
      public.fv_json_number(p.profile #>> '{location,lng}') as lng,
      coalesce(viewer_pe.premium_until > now(),false) as premium_active
    from (select auth.uid() as uid) a
    left join public.fv_profiles p on p.user_id=a.uid
    left join public.fv_premium_entitlements viewer_pe on viewer_pe.user_id=a.uid
  ), candidates as (
    select
      p.*,
      public.fv_json_number(p.profile #>> '{location,lat}') as lat,
      public.fv_json_number(p.profile #>> '{location,lng}') as lng
    from public.fv_profiles p
    where auth.uid() is not null and p.user_id <> auth.uid()
  )
  select
    p.id,
    p.user_id,
    case
      when (not me.premium_active) and (d.miles is null or d.miles > 50) then null
      when p.email is null then null else 'verified'
    end as email,
    case
      when (not me.premium_active) and (d.miles is null or d.miles > 50) then
        jsonb_build_object(
          'distanceMiles',case when d.miles is null then null else round(d.miles::numeric,0)::integer end,
          'premiumLocked',true
        )
      else
        (
          coalesce(p.profile,'{}'::jsonb)
            - 'rewards' - 'weeklyGoals' - 'inventory'
            - 'location' - 'locationPromptedAt' - 'locationConsentState'
        ) || jsonb_build_object(
          'inventory',jsonb_build_object(
            'equipped',coalesce((
              select jsonb_object_agg(s.item_type,s.item_value)
              from public.fv_user_inventory ui
              join public.fv_shop_items s on s.item_id=ui.item_id
              where ui.user_id=p.user_id and ui.equipped=true and s.active=true
            ),'{}'::jsonb)
          ),
          'distanceMiles',case when d.miles is null then null else round(d.miles::numeric,0)::integer end,
          'premiumActive',coalesce(pe.premium_until > now(),false),
          'premiumLocked',false
        )
    end as profile,
    case
      when (not me.premium_active) and (d.miles is null or d.miles > 50) then '{}'::jsonb
      else coalesce((
        select jsonb_object_agg(e.key,e.value)
        from jsonb_each(coalesce(p.ratings,'{}'::jsonb)) e
        where me.ratings ? e.key
      ),'{}'::jsonb)
    end as ratings,
    case
      when (not me.premium_active) and (d.miles is null or d.miles > 50) then '[]'::jsonb
      when coalesce(p.liked,'[]'::jsonb) ? auth.uid()::text then jsonb_build_array(auth.uid()::text)
      else '[]'::jsonb
    end as liked,
    p.updated_at
  from candidates p
  cross join me
  left join public.fv_premium_entitlements pe on pe.user_id=p.user_id
  cross join lateral (
    select case
      when me.lat between -90 and 90 and me.lng between -180 and 180
       and p.lat between -90 and 90 and p.lng between -180 and 180
      then 3958.7613 * 2 * asin(least(1.0,sqrt(
        power(sin(radians(p.lat-me.lat)/2),2)
        + cos(radians(me.lat))*cos(radians(p.lat))*power(sin(radians(p.lng-me.lng)/2),2)
      )))
      else null
    end as miles
  ) d
  order by d.miles nulls last,p.updated_at desc
  limit least(greatest(coalesce(p_limit,80),1),250);
$$;

grant execute on function public.fv_get_directory(integer) to authenticated;
revoke all on function public.fv_get_directory(integer) from public, anon;

create or replace function public.fv_admin_health_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.fv_is_admin() then raise exception 'Admin access required'; end if;
  return jsonb_build_object(
    'profiles',(select count(*) from public.fv_profiles),
    'profiles_with_answers',(select count(*) from public.fv_profiles where public.fv_jsonb_object_size(ratings)>0),
    'wallets',(select count(*) from public.fv_wallets),
    'ledger_entries',(select count(*) from public.fv_wallet_ledger),
    'active_premium',(select count(*) from public.fv_premium_entitlements where premium_until>now()),
    'pending_wallet_recoveries',(select count(*) from public.fv_wallet_recovery_requests where status='pending'),
    'revision_backups',(select count(*) from public.fv_profile_revisions),
    'activity_events',(select count(*) from public.fv_activity_events),
    'private_album_photos',(select count(*) from public.fv_private_album_photos),
    'accepted_album_grants',(select count(*) from public.fv_album_access where status='accepted'),
    'generated_at',now()
  );
end;
$$;

grant execute on function public.fv_admin_health_summary() to authenticated;
revoke all on function public.fv_admin_health_summary() from public, anon;

create or replace function public.fv_admin_export_backup()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.fv_is_admin() then raise exception 'Admin access required'; end if;
  return jsonb_build_object(
    'format','afterglow-server-backup-v2',
    'generated_at',now(),
    'profiles',coalesce((select jsonb_agg(to_jsonb(x) order by x.user_id) from public.fv_profiles x),'[]'::jsonb),
    'wallets',coalesce((select jsonb_agg(to_jsonb(x) order by x.user_id) from public.fv_wallets x),'[]'::jsonb),
    'wallet_ledger',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.fv_wallet_ledger x),'[]'::jsonb),
    'premium_entitlements',coalesce((select jsonb_agg(to_jsonb(x) order by x.user_id) from public.fv_premium_entitlements x),'[]'::jsonb),
    'shop_items',coalesce((select jsonb_agg(to_jsonb(x) order by x.item_id) from public.fv_shop_items x),'[]'::jsonb),
    'user_inventory',coalesce((select jsonb_agg(to_jsonb(x) order by x.user_id,x.purchased_at) from public.fv_user_inventory x),'[]'::jsonb),
    'weekly_goal_claims',coalesce((select jsonb_agg(to_jsonb(x) order by x.user_id,x.week_key,x.goal_id) from public.fv_weekly_goal_claims x),'[]'::jsonb),
    'activity_events',coalesce((select jsonb_agg(to_jsonb(x) order by x.user_id,x.created_at) from public.fv_activity_events x),'[]'::jsonb),
    'wallet_recovery_requests',coalesce((select jsonb_agg(to_jsonb(x) order by x.user_id) from public.fv_wallet_recovery_requests x),'[]'::jsonb),
    'album_access',coalesce((select jsonb_agg(to_jsonb(x) order by x.owner_id,x.requester_id) from public.fv_album_access x),'[]'::jsonb),
    'private_album_photo_metadata',coalesce((select jsonb_agg(to_jsonb(x) order by x.owner_id,x.created_at) from public.fv_private_album_photos x),'[]'::jsonb),
    'admin_config',coalesce((select jsonb_agg(to_jsonb(x) order by x.key) from public.fv_admin_config x),'[]'::jsonb),
    'storage_note','Database metadata only. Supabase Storage object bytes are not embedded in this JSON export.'
  );
end;
$$;

grant execute on function public.fv_admin_export_backup() to authenticated;
revoke all on function public.fv_admin_export_backup() from public, anon;

commit;
