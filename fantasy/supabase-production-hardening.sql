-- Afterglow production hardening migration (v2)
-- Safe to run repeatedly. This migration keeps existing profile data, backfills
-- the wallet/inventory tables, and adds revision history before future writes.

begin;

create extension if not exists pgcrypto;

create or replace function public.fv_is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'ra1nonit1@gmail.com';
$$;

-- ---------------------------------------------------------------------------
-- Durable profile state + revision history
-- ---------------------------------------------------------------------------
alter table public.fv_profiles add column if not exists inventory jsonb not null default '{"owned":[],"equipped":{}}'::jsonb;
alter table public.fv_profiles add column if not exists weekly_goals jsonb not null default '{}'::jsonb;
alter table public.fv_profiles add column if not exists client_updated_at timestamptz;
alter table public.fv_profiles add column if not exists client_id text;
alter table public.fv_profiles add column if not exists state_version integer not null default 2;
alter table public.fv_profiles add column if not exists sync_revision bigint not null default 0;
alter table public.fv_profiles add column if not exists last_synced_at timestamptz not null default now();

-- Backfill state that older builds embedded inside profile JSON.
update public.fv_profiles
set inventory = case
    when inventory is null or inventory = '{}'::jsonb then coalesce(profile -> 'inventory', '{"owned":[],"equipped":{}}'::jsonb)
    else inventory
  end,
  weekly_goals = case
    when weekly_goals is null or weekly_goals = '{}'::jsonb then coalesce(profile -> 'weeklyGoals', '{}'::jsonb)
    else weekly_goals
  end,
  client_updated_at = coalesce(client_updated_at, updated_at, now()),
  state_version = greatest(coalesce(state_version, 1), 2),
  last_synced_at = coalesce(last_synced_at, updated_at, now());

create table if not exists public.fv_profile_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  reason text not null default 'sync',
  profile jsonb not null default '{}'::jsonb,
  ratings jsonb not null default '{}'::jsonb,
  liked jsonb not null default '[]'::jsonb,
  passed jsonb not null default '[]'::jsonb,
  inventory jsonb not null default '{"owned":[],"equipped":{}}'::jsonb,
  weekly_goals jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists fv_profile_revisions_user_created_idx
  on public.fv_profile_revisions(user_id, created_at desc);

alter table public.fv_profile_revisions enable row level security;
drop policy if exists "Users can read own Afterglow revisions" on public.fv_profile_revisions;
drop policy if exists "Owner can read Afterglow revisions" on public.fv_profile_revisions;
create policy "Users can read own Afterglow revisions"
on public.fv_profile_revisions for select to authenticated
using (auth.uid() = user_id);
create policy "Owner can read Afterglow revisions"
on public.fv_profile_revisions for select to authenticated
using (public.fv_is_admin());

grant select on public.fv_profile_revisions to authenticated;

-- Stop exposing every user's entire raw profile row. Directory reads now use
-- fv_get_directory(), which strips private wallet/goal data and hides like lists.
drop policy if exists "Authenticated users can read Fantasy Vault directory" on public.fv_profiles;
drop policy if exists "Users can read own Fantasy Vault profile" on public.fv_profiles;
drop policy if exists "Owner can read all Afterglow profiles" on public.fv_profiles;
create policy "Users can read own Fantasy Vault profile"
on public.fv_profiles for select to authenticated
using (auth.uid() = user_id);
create policy "Owner can read all Afterglow profiles"
on public.fv_profiles for select to authenticated
using (public.fv_is_admin());

create or replace function public.fv_jsonb_object_size(value jsonb)
returns integer
language sql
immutable
set search_path = public
as $$
  select case when jsonb_typeof(coalesce(value, '{}'::jsonb)) = 'object'
    then jsonb_object_length(coalesce(value, '{}'::jsonb)) else 0 end;
$$;

create or replace function public.fv_jsonb_array_size(value jsonb)
returns integer
language sql
immutable
set search_path = public
as $$
  select case when jsonb_typeof(coalesce(value, '[]'::jsonb)) = 'array'
    then jsonb_array_length(coalesce(value, '[]'::jsonb)) else 0 end;
$$;

-- Server-observed activity proves that weekly goals happened during the current
-- week. A plain profile resync cannot manufacture a fresh mood/rating action.
create table if not exists public.fv_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check(event_type in ('mood','vault_rating')),
  event_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fv_activity_events_user_type_created_idx
  on public.fv_activity_events(user_id,event_type,created_at desc);

alter table public.fv_activity_events enable row level security;
drop policy if exists "Users can read own Afterglow activity" on public.fv_activity_events;
drop policy if exists "Owner can read Afterglow activity" on public.fv_activity_events;
create policy "Users can read own Afterglow activity"
on public.fv_activity_events for select to authenticated
using(auth.uid()=user_id);
create policy "Owner can read Afterglow activity"
on public.fv_activity_events for select to authenticated
using(public.fv_is_admin());

grant select on public.fv_activity_events to authenticated;

drop function if exists public.fv_save_my_state(jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,timestamptz,text,integer,text);
drop function if exists public.fv_save_my_state(jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,timestamptz,text,integer,text,bigint);

create or replace function public.fv_save_my_state(
  p_profile jsonb default '{}'::jsonb,
  p_ratings jsonb default '{}'::jsonb,
  p_liked jsonb default '[]'::jsonb,
  p_passed jsonb default '[]'::jsonb,
  p_inventory jsonb default '{"owned":[],"equipped":{}}'::jsonb,
  p_weekly_goals jsonb default '{}'::jsonb,
  p_client_updated_at timestamptz default now(),
  p_client_id text default null,
  p_state_version integer default 2,
  p_reason text default 'sync',
  p_base_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.fv_profiles%rowtype;
  v_row public.fv_profiles%rowtype;
  v_snapshot_needed boolean := false;
  v_clean_profile jsonb;
  v_old_mood text;
  v_new_mood text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  v_clean_profile := coalesce(p_profile, '{}'::jsonb) - 'rewards' - 'weeklyGoals' - 'inventory';
  p_ratings := case when jsonb_typeof(coalesce(p_ratings, '{}'::jsonb)) = 'object' then p_ratings else '{}'::jsonb end;
  p_liked := case when jsonb_typeof(coalesce(p_liked, '[]'::jsonb)) = 'array' then p_liked else '[]'::jsonb end;
  p_passed := case when jsonb_typeof(coalesce(p_passed, '[]'::jsonb)) = 'array' then p_passed else '[]'::jsonb end;
  p_inventory := case when jsonb_typeof(coalesce(p_inventory, '{}'::jsonb)) = 'object' then p_inventory else '{"owned":[],"equipped":{}}'::jsonb end;
  p_weekly_goals := case when jsonb_typeof(coalesce(p_weekly_goals, '{}'::jsonb)) = 'object' then p_weekly_goals else '{}'::jsonb end;

  -- Test-profile IDs and malformed values never enter another user's durable
  -- like/pass graph. Arrays are deduplicated and practically bounded.
  select coalesce(jsonb_agg(x.value order by x.value),'[]'::jsonb) into p_liked
  from (
    select distinct value
    from jsonb_array_elements_text(p_liked)
    where value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    order by value limit 5000
  ) x;
  select coalesce(jsonb_agg(x.value order by x.value),'[]'::jsonb) into p_passed
  from (
    select distinct value
    from jsonb_array_elements_text(p_passed)
    where value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    order by value limit 5000
  ) x;

  if pg_column_size(v_clean_profile)>262144 then raise exception 'Profile payload is too large'; end if;
  if pg_column_size(p_ratings)>1048576 then raise exception 'Vault payload is too large'; end if;
  if pg_column_size(p_inventory)>262144 then raise exception 'Inventory payload is too large'; end if;
  if pg_column_size(p_weekly_goals)>262144 then raise exception 'Weekly-goal payload is too large'; end if;
  p_client_updated_at:=least(coalesce(p_client_updated_at,now()),now()+interval '5 minutes');

  select * into v_existing from public.fv_profiles where user_id = v_uid for update;

  if not found then
    insert into public.fv_profiles(
      user_id,email,profile,ratings,liked,passed,inventory,weekly_goals,
      client_updated_at,client_id,state_version,sync_revision,last_synced_at,updated_at
    ) values (
      v_uid, auth.jwt() ->> 'email', v_clean_profile, p_ratings, p_liked, p_passed,
      p_inventory, p_weekly_goals, coalesce(p_client_updated_at, now()), left(p_client_id,120),
      greatest(coalesce(p_state_version,2),2), 1, now(), now()
    ) returning * into v_row;

    v_new_mood:=v_clean_profile->>'mood';
    if v_new_mood in ('flirty','romantic','curious','playful','cozy','private') then
      insert into public.fv_activity_events(user_id,event_type,event_key,metadata)
      values(v_uid,'mood',v_new_mood,jsonb_build_object('source','initial_profile'));
    end if;
    insert into public.fv_activity_events(user_id,event_type,event_key,metadata)
    select v_uid,'vault_rating',e.key,jsonb_build_object('source','initial_profile')
    from jsonb_each(p_ratings) e
    where e.value <> 'null'::jsonb;

    return jsonb_build_object('status','saved','row',to_jsonb(v_row));
  end if;

  -- Every client sync is based on the last server revision it observed. A
  -- second device or stale cached build must merge the newer row before writing.
  if p_base_revision is not null and p_base_revision<>v_existing.sync_revision then
    return jsonb_build_object('status','conflict','row',to_jsonb(v_existing));
  end if;

  -- A stale or empty browser cannot remove durable keys, even if its device
  -- clock is ahead. The client receives the current row, merges it, and retries.
  if exists(
       select 1 from jsonb_object_keys(coalesce(v_existing.ratings,'{}'::jsonb)) key
       where not coalesce(p_ratings,'{}'::jsonb) ? key
     )
     or exists(
       select 1 from jsonb_array_elements_text(
         case when jsonb_typeof(coalesce(v_existing.inventory->'owned','[]'::jsonb))='array' then v_existing.inventory->'owned' else '[]'::jsonb end
       ) owned(item_id)
       where not coalesce(p_inventory->'owned','[]'::jsonb) ? owned.item_id
     )
     or (
       coalesce(p_weekly_goals->>'week','')=coalesce(v_existing.weekly_goals->>'week','')
       and exists(
         select 1 from jsonb_object_keys(coalesce(v_existing.weekly_goals->'completed','{}'::jsonb)) key
         where not coalesce(p_weekly_goals->'completed','{}'::jsonb) ? key
       )
     ) then
    return jsonb_build_object('status','conflict','row',to_jsonb(v_existing));
  end if;

  -- Profile fields are intentionally durable. Empty strings/nulls from an old
  -- cached form do not erase a previously populated value.
  select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb)
  into v_clean_profile
  from jsonb_each(coalesce(v_clean_profile,'{}'::jsonb)) e
  where e.value <> 'null'::jsonb
    and not (jsonb_typeof(e.value)='string' and trim(both '"' from e.value::text)='');
  v_clean_profile := coalesce(v_existing.profile,'{}'::jsonb) || v_clean_profile;

  select not exists (
    select 1 from public.fv_profile_revisions r
    where r.user_id = v_uid and r.created_at > now() - interval '10 minutes'
  )
  or public.fv_jsonb_object_size(p_ratings) < public.fv_jsonb_object_size(v_existing.ratings)
  or public.fv_jsonb_array_size(p_inventory -> 'owned') < public.fv_jsonb_array_size(v_existing.inventory -> 'owned')
  into v_snapshot_needed;

  if v_snapshot_needed then
    insert into public.fv_profile_revisions(
      user_id,revision,reason,profile,ratings,liked,passed,inventory,weekly_goals,client_updated_at
    ) values (
      v_uid,v_existing.sync_revision,coalesce(nullif(left(p_reason,80),''),'sync'),
      v_existing.profile,v_existing.ratings,v_existing.liked,v_existing.passed,
      v_existing.inventory,v_existing.weekly_goals,v_existing.client_updated_at
    );
  end if;

  v_old_mood:=v_existing.profile->>'mood';
  v_new_mood:=v_clean_profile->>'mood';
  if v_new_mood in ('flirty','romantic','curious','playful','cozy','private')
     and v_new_mood is distinct from v_old_mood then
    insert into public.fv_activity_events(user_id,event_type,event_key,metadata)
    values(v_uid,'mood',v_new_mood,jsonb_build_object('previous',v_old_mood));
  end if;

  insert into public.fv_activity_events(user_id,event_type,event_key,metadata)
  select v_uid,'vault_rating',e.key,jsonb_build_object('previous',v_existing.ratings->e.key)
  from jsonb_each(p_ratings) e
  where (v_existing.ratings->e.key) is distinct from e.value
    and e.value <> 'null'::jsonb;

  update public.fv_profiles
  set email = coalesce(auth.jwt() ->> 'email', email),
      profile = v_clean_profile,
      ratings = p_ratings,
      liked = p_liked,
      passed = p_passed,
      inventory = p_inventory,
      weekly_goals = p_weekly_goals,
      client_updated_at = greatest(coalesce(p_client_updated_at, now()), coalesce(v_existing.client_updated_at, '-infinity'::timestamptz)),
      client_id = left(p_client_id,120),
      state_version = greatest(coalesce(p_state_version,2),2),
      sync_revision = coalesce(v_existing.sync_revision,0) + 1,
      last_synced_at = now(),
      updated_at = now()
  where user_id = v_uid
  returning * into v_row;

  delete from public.fv_profile_revisions
  where id in (
    select id from public.fv_profile_revisions
    where user_id = v_uid
    order by created_at desc
    offset 75
  );

  return jsonb_build_object('status','saved','row',to_jsonb(v_row));
end;
$$;

create or replace function public.fv_restore_my_revision(p_revision_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rev public.fv_profile_revisions%rowtype;
  v_current public.fv_profiles%rowtype;
  v_row public.fv_profiles%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_rev from public.fv_profile_revisions where id = p_revision_id and user_id = v_uid;
  if not found then raise exception 'Revision not found'; end if;
  select * into v_current from public.fv_profiles where user_id = v_uid for update;
  if found then
    insert into public.fv_profile_revisions(
      user_id,revision,reason,profile,ratings,liked,passed,inventory,weekly_goals,client_updated_at
    ) values (
      v_uid,v_current.sync_revision,'before_restore',v_current.profile,v_current.ratings,
      v_current.liked,v_current.passed,v_current.inventory,v_current.weekly_goals,v_current.client_updated_at
    );
  end if;
  update public.fv_profiles
  set profile=v_rev.profile,ratings=v_rev.ratings,liked=v_rev.liked,passed=v_rev.passed,
      inventory=v_rev.inventory,weekly_goals=v_rev.weekly_goals,
      client_updated_at=now(),sync_revision=coalesce(sync_revision,0)+1,
      state_version=2,last_synced_at=now(),updated_at=now()
  where user_id=v_uid returning * into v_row;
  return jsonb_build_object('status','restored','row',to_jsonb(v_row));
end;
$$;

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
    select coalesce(p.ratings,'{}'::jsonb) as ratings
    from public.fv_profiles p where p.user_id = auth.uid()
  )
  select p.id,p.user_id,case when p.email is null then null else 'verified' end as email,
    (coalesce(p.profile,'{}'::jsonb) - 'rewards' - 'weeklyGoals' - 'inventory')
      || jsonb_build_object('inventory', jsonb_build_object('equipped', coalesce(p.inventory -> 'equipped','{}'::jsonb))) as profile,
    coalesce((
      select jsonb_object_agg(e.key,e.value)
      from jsonb_each(coalesce(p.ratings,'{}'::jsonb)) e
      where exists (select 1 from me where me.ratings ? e.key)
    ),'{}'::jsonb) as ratings,
    case when coalesce(p.liked,'[]'::jsonb) ? auth.uid()::text
      then jsonb_build_array(auth.uid()::text) else '[]'::jsonb end as liked,
    p.updated_at
  from public.fv_profiles p
  where auth.uid() is not null and p.user_id <> auth.uid()
  order by p.updated_at desc
  limit least(greatest(coalesce(p_limit,80),1),250);
$$;

grant execute on function public.fv_save_my_state(jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,timestamptz,text,integer,text,bigint) to authenticated;
grant execute on function public.fv_restore_my_revision(uuid) to authenticated;
grant execute on function public.fv_get_directory(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Server-authoritative Glow Coin wallet, ledger, shop and inventory
-- ---------------------------------------------------------------------------
create table if not exists public.fv_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  glow_coins integer not null default 0 check (glow_coins >= 0),
  streak integer not null default 0 check (streak >= 0),
  last_claim_date date,
  last_claimed_at timestamptz,
  timezone text not null default 'UTC',
  timezone_verified boolean not null default false,
  lifetime_earned integer not null default 0 check (lifetime_earned >= 0),
  lifetime_spent integer not null default 0 check (lifetime_spent >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fv_wallets add column if not exists timezone_verified boolean not null default false;

alter table public.fv_wallets drop constraint if exists fv_wallets_streak_check;
alter table public.fv_wallets add constraint fv_wallets_streak_check check (streak >= 0);

create table if not exists public.fv_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  balance_after integer not null check (balance_after >= 0),
  entry_type text not null,
  source_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, source_key)
);

create index if not exists fv_wallet_ledger_user_created_idx
  on public.fv_wallet_ledger(user_id, created_at desc);

create table if not exists public.fv_shop_items (
  item_id text primary key,
  category text not null,
  title text not null,
  price integer not null check (price >= 0),
  item_type text not null,
  item_value text not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.fv_user_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.fv_shop_items(item_id) on delete restrict,
  equipped boolean not null default false,
  purchased_at timestamptz not null default now(),
  equipped_at timestamptz,
  primary key(user_id,item_id)
);

create table if not exists public.fv_weekly_goal_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_key text not null,
  goal_id text not null,
  coins integer not null check (coins > 0),
  claimed_at timestamptz not null default now(),
  primary key(user_id,week_key,goal_id)
);

create table if not exists public.fv_wallet_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  requested_balance integer not null check(requested_balance >= 0),
  server_balance_at_request integer not null check(server_balance_at_request >= 0),
  legacy_last_claim_date date,
  legacy_streak integer not null default 0 check(legacy_streak >= 0),
  metrics jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check(status in ('pending','approved','rejected','not_needed')),
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text,
  resolution_note text
);

alter table public.fv_wallets enable row level security;
alter table public.fv_wallet_ledger enable row level security;
alter table public.fv_shop_items enable row level security;
alter table public.fv_user_inventory enable row level security;
alter table public.fv_weekly_goal_claims enable row level security;
alter table public.fv_wallet_recovery_requests enable row level security;

drop policy if exists "Users can read own Afterglow wallet" on public.fv_wallets;
drop policy if exists "Owner can read Afterglow wallets" on public.fv_wallets;
create policy "Users can read own Afterglow wallet" on public.fv_wallets for select to authenticated using (auth.uid()=user_id);
create policy "Owner can read Afterglow wallets" on public.fv_wallets for select to authenticated using (public.fv_is_admin());

drop policy if exists "Users can read own Afterglow ledger" on public.fv_wallet_ledger;
drop policy if exists "Owner can read Afterglow ledger" on public.fv_wallet_ledger;
create policy "Users can read own Afterglow ledger" on public.fv_wallet_ledger for select to authenticated using (auth.uid()=user_id);
create policy "Owner can read Afterglow ledger" on public.fv_wallet_ledger for select to authenticated using (public.fv_is_admin());

drop policy if exists "Authenticated users can read Afterglow shop" on public.fv_shop_items;
create policy "Authenticated users can read Afterglow shop" on public.fv_shop_items for select to authenticated using (true);

drop policy if exists "Users can read own Afterglow inventory" on public.fv_user_inventory;
drop policy if exists "Owner can read Afterglow inventory" on public.fv_user_inventory;
create policy "Users can read own Afterglow inventory" on public.fv_user_inventory for select to authenticated using (auth.uid()=user_id);
create policy "Owner can read Afterglow inventory" on public.fv_user_inventory for select to authenticated using (public.fv_is_admin());

drop policy if exists "Users can read own weekly claims" on public.fv_weekly_goal_claims;
create policy "Users can read own weekly claims" on public.fv_weekly_goal_claims for select to authenticated using (auth.uid()=user_id);

drop policy if exists "Users can read own wallet recovery request" on public.fv_wallet_recovery_requests;
drop policy if exists "Owner can read wallet recovery requests" on public.fv_wallet_recovery_requests;
create policy "Users can read own wallet recovery request" on public.fv_wallet_recovery_requests for select to authenticated using(auth.uid()=user_id);
create policy "Owner can read wallet recovery requests" on public.fv_wallet_recovery_requests for select to authenticated using(public.fv_is_admin());

grant select on public.fv_wallets,public.fv_wallet_ledger,public.fv_shop_items,public.fv_user_inventory,public.fv_weekly_goal_claims,public.fv_wallet_recovery_requests to authenticated;

insert into public.fv_shop_items(item_id,category,title,price,item_type,item_value,metadata) values
('frame-neon','Profile','Neon Profile Ring',35,'avatarFrame','frame-neon','{}'),
('frame-gold','Profile','Gold Profile Ring',45,'avatarFrame','frame-gold','{}'),
('frame-rainbow','Profile','Rainbow Profile Ring',65,'avatarFrame','frame-rainbow','{}'),
('theme-midnight','Themes','Midnight Banner',25,'profileTheme','theme-midnight','{}'),
('theme-rose-gold','Themes','Rose Gold Banner',30,'profileTheme','theme-rose-gold','{}'),
('theme-cyber','Themes','Cyber Glow Banner',40,'profileTheme','theme-cyber','{}'),
('theme-velvet','Themes','Dark Velvet Banner',40,'profileTheme','theme-velvet','{}'),
('badge-early','Badges','Early Glower Badge',50,'badge','early-glower','{}'),
('badge-streak','Badges','Streak Keeper Badge',75,'badge','streak-keeper','{}'),
('chat-hearts','Chat','Heart Reaction Pack',20,'chatPack','chat-hearts','{}'),
('chat-fire','Chat','Fire Reaction Pack',20,'chatPack','chat-fire','{}'),
('vault-spark','Vault','Spark Vault Cards',30,'vaultStyle','vault-spark','{}'),
('vault-gold','Vault','Gold Vault Accent',45,'vaultStyle','vault-gold','{}'),
('sticker-flirt','Stickers','Flirty Sticker Pack',25,'stickerPack','flirty','{}'),
('sticker-soft','Stickers','Soft Romance Stickers',25,'stickerPack','soft-romance','{}'),
('fx-avatar-sparkle','Effects','Sparkle Aura',45,'avatarEffect','fx-sparkle','{}'),
('fx-avatar-pulse','Effects','Heartbeat Glow',50,'avatarEffect','fx-heartbeat','{}'),
('fx-avatar-embers','Effects','Afterglow Embers',65,'avatarEffect','fx-embers','{}'),
('fx-profile-stars','Effects','Midnight Stars Profile',70,'profileEffect','fx-stars','{}'),
('fx-profile-hearts','Effects','Floating Hearts Profile',70,'profileEffect','fx-hearts','{}'),
('tool-color-picker','Colors','Full Color Picker',1000,'colorTool','color-picker','{}'),
('color-afterglow-pink','Colors','Afterglow Pink',80,'colorway','afterglow-pink','{"a":"#ff3f91","b":"#8b5cff"}'),
('color-golden-hour','Colors','Golden Hour',90,'colorway','golden-hour','{"a":"#ffd37a","b":"#ff6b73"}'),
('color-midnight-blue','Colors','Midnight Blue',90,'colorway','midnight-blue','{"a":"#57c8ff","b":"#7c5cff"}'),
('color-emerald-lust','Colors','Emerald Glow',90,'colorway','emerald-glow','{"a":"#65ffb8","b":"#57c8ff"}'),
('color-red-velvet','Colors','Red Velvet',110,'colorway','red-velvet','{"a":"#ff3b4f","b":"#b1125b"}')
on conflict (item_id) do update set
  category=excluded.category,title=excluded.title,price=excluded.price,item_type=excluded.item_type,
  item_value=excluded.item_value,metadata=excluded.metadata,active=true,updated_at=now();

-- Backfill wallet balances without ever lowering an existing wallet.
insert into public.fv_wallets(user_id,glow_coins,streak,last_claim_date,last_claimed_at,timezone,timezone_verified,lifetime_earned)
select p.user_id,
  case when coalesce(p.profile #>> '{rewards,glowCoins}','') ~ '^\d+$' then (p.profile #>> '{rewards,glowCoins}')::integer else 0 end,
  case when coalesce(p.profile #>> '{rewards,streak}','') ~ '^\d+$' then (p.profile #>> '{rewards,streak}')::integer else 0 end,
  case when coalesce(p.profile #>> '{rewards,lastClaimDate}','') ~ '^\d{4}-\d{2}-\d{2}$' then (p.profile #>> '{rewards,lastClaimDate}')::date else null end,
  null,
  'UTC',
  false,
  case when coalesce(p.profile #>> '{rewards,glowCoins}','') ~ '^\d+$' then (p.profile #>> '{rewards,glowCoins}')::integer else 0 end
from public.fv_profiles p
where p.user_id is not null
on conflict (user_id) do update set
  glow_coins=greatest(public.fv_wallets.glow_coins,excluded.glow_coins),
  streak=greatest(public.fv_wallets.streak,excluded.streak),
  last_claim_date=greatest(public.fv_wallets.last_claim_date,excluded.last_claim_date),
  lifetime_earned=greatest(public.fv_wallets.lifetime_earned,excluded.lifetime_earned),
  updated_at=now();

insert into public.fv_user_inventory(user_id,item_id,equipped)
select p.user_id,owned.item_id,false
from public.fv_profiles p
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(coalesce(p.inventory -> 'owned','[]'::jsonb))='array' then p.inventory -> 'owned' else '[]'::jsonb end
) owned(item_id)
join public.fv_shop_items s on s.item_id=owned.item_id
on conflict (user_id,item_id) do nothing;

update public.fv_user_inventory ui
set equipped=true,equipped_at=coalesce(equipped_at,now())
from public.fv_profiles p, public.fv_shop_items s
where p.user_id=ui.user_id and s.item_id=ui.item_id
  and coalesce(p.inventory -> 'equipped' ->> s.item_type,'')=s.item_value;

-- Public profile cosmetics are composed from purchased server inventory, never
-- from editable browser JSON.
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
    select coalesce(p.ratings,'{}'::jsonb) as ratings
    from public.fv_profiles p where p.user_id = auth.uid()
  )
  select p.id,p.user_id,case when p.email is null then null else 'verified' end as email,
    (coalesce(p.profile,'{}'::jsonb) - 'rewards' - 'weeklyGoals' - 'inventory')
      || jsonb_build_object(
        'inventory',jsonb_build_object(
          'equipped',coalesce((
            select jsonb_object_agg(s.item_type,s.item_value)
            from public.fv_user_inventory ui
            join public.fv_shop_items s on s.item_id=ui.item_id
            where ui.user_id=p.user_id and ui.equipped=true and s.active=true
          ),'{}'::jsonb)
        )
      ) as profile,
    coalesce((
      select jsonb_object_agg(e.key,e.value)
      from jsonb_each(coalesce(p.ratings,'{}'::jsonb)) e
      where exists (select 1 from me where me.ratings ? e.key)
    ),'{}'::jsonb) as ratings,
    case when coalesce(p.liked,'[]'::jsonb) ? auth.uid()::text
      then jsonb_build_array(auth.uid()::text) else '[]'::jsonb end as liked,
    p.updated_at
  from public.fv_profiles p
  where auth.uid() is not null and p.user_id <> auth.uid()
  order by p.updated_at desc
  limit least(greatest(coalesce(p_limit,80),1),250);
$$;

grant execute on function public.fv_get_directory(integer) to authenticated;

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
    ),'[]'::jsonb)
  );
$$;

revoke all on function public.fv_economy_json(uuid) from public, anon, authenticated;

create or replace function public.fv_get_my_economy()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.fv_wallets(user_id,timezone) values(auth.uid(),'UTC') on conflict do nothing;
  return public.fv_economy_json(auth.uid());
end;
$$;

create or replace function public.fv_request_wallet_recovery(
  p_requested_balance integer,
  p_last_claim_date date default null,
  p_streak integer default 0,
  p_metrics jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid:=auth.uid();
  v_wallet public.fv_wallets%rowtype;
  v_request public.fv_wallet_recovery_requests%rowtype;
  v_requested integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  v_requested:=least(greatest(coalesce(p_requested_balance,0),0),10000000);
  insert into public.fv_wallets(user_id,timezone) values(v_uid,'UTC') on conflict do nothing;
  select * into v_wallet from public.fv_wallets where user_id=v_uid for update;

  if v_requested<=v_wallet.glow_coins then
    insert into public.fv_wallet_recovery_requests(
      user_id,requested_balance,server_balance_at_request,legacy_last_claim_date,legacy_streak,metrics,status,resolved_at,resolved_by,resolution_note
    ) values(
      v_uid,v_requested,v_wallet.glow_coins,p_last_claim_date,greatest(coalesce(p_streak,0),0),coalesce(p_metrics,'{}'::jsonb),
      'not_needed',now(),'system','Server wallet already contains this balance or more.'
    )
    on conflict(user_id) do update set
      server_balance_at_request=excluded.server_balance_at_request,status='not_needed',updated_at=now(),
      resolved_at=now(),resolved_by='system',resolution_note=excluded.resolution_note
    returning * into v_request;
    return jsonb_build_object('status','not_needed','request',to_jsonb(v_request),'economy',public.fv_economy_json(v_uid));
  end if;

  insert into public.fv_wallet_recovery_requests(
    user_id,requested_balance,server_balance_at_request,legacy_last_claim_date,legacy_streak,metrics,status,requested_at,updated_at,resolved_at,resolved_by,resolution_note
  ) values(
    v_uid,v_requested,v_wallet.glow_coins,p_last_claim_date,greatest(coalesce(p_streak,0),0),coalesce(p_metrics,'{}'::jsonb),
    'pending',now(),now(),null,null,null
  )
  on conflict(user_id) do update set
    requested_balance=greatest(public.fv_wallet_recovery_requests.requested_balance,excluded.requested_balance),
    server_balance_at_request=excluded.server_balance_at_request,
    legacy_last_claim_date=coalesce(excluded.legacy_last_claim_date,public.fv_wallet_recovery_requests.legacy_last_claim_date),
    legacy_streak=greatest(public.fv_wallet_recovery_requests.legacy_streak,excluded.legacy_streak),
    metrics=public.fv_wallet_recovery_requests.metrics||excluded.metrics,status='pending',updated_at=now(),
    resolved_at=null,resolved_by=null,resolution_note=null
  returning * into v_request;

  return jsonb_build_object('status','pending_review','request',to_jsonb(v_request),'economy',public.fv_economy_json(v_uid));
end;
$$;

create or replace function public.fv_claim_daily_glow(p_timezone text default 'UTC')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid:=auth.uid();
  v_wallet public.fv_wallets%rowtype;
  v_tz text;
  v_today date;
  v_streak integer;
  v_reward integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select name into v_tz from pg_timezone_names where name=p_timezone limit 1;
  v_tz:=coalesce(v_tz,'UTC');
  insert into public.fv_wallets(user_id,timezone,timezone_verified) values(v_uid,v_tz,true) on conflict do nothing;
  select * into v_wallet from public.fv_wallets where user_id=v_uid for update;
  if not coalesce(v_wallet.timezone_verified,false) then
    update public.fv_wallets set timezone=v_tz,timezone_verified=true,updated_at=now() where user_id=v_uid;
    v_wallet.timezone:=v_tz;
    v_wallet.timezone_verified:=true;
  end if;
  v_today:=timezone(v_wallet.timezone,now())::date;
  if v_wallet.last_claim_date=v_today then
    return jsonb_build_object('status','already_claimed','reward',0,'economy',public.fv_economy_json(v_uid));
  end if;
  v_streak:=case when v_wallet.last_claim_date=v_today-1 then v_wallet.streak+1 else 1 end;
  v_reward:=case v_streak when 1 then 5 when 2 then 10 when 3 then 15 when 4 then 15 when 5 then 20 when 6 then 20 else 50 end;
  update public.fv_wallets set
    glow_coins=glow_coins+v_reward,streak=v_streak,last_claim_date=v_today,last_claimed_at=now(),
    lifetime_earned=lifetime_earned+v_reward,updated_at=now()
  where user_id=v_uid returning * into v_wallet;
  insert into public.fv_wallet_ledger(user_id,amount,balance_after,entry_type,source_key,metadata)
  values(v_uid,v_reward,v_wallet.glow_coins,'daily_reward','daily:'||v_today::text,jsonb_build_object('streak',v_streak,'timezone',v_wallet.timezone))
  on conflict (user_id,source_key) do nothing;
  return jsonb_build_object('status','claimed','reward',v_reward,'economy',public.fv_economy_json(v_uid));
end;
$$;

create or replace function public.fv_claim_weekly_goal(p_goal_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid:=auth.uid();
  v_wallet public.fv_wallets%rowtype;
  v_week text;
  v_coins integer;
  v_inserted integer;
  v_week_start date;
  v_eligible boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  v_coins:=case p_goal_id when 'mood' then 10 when 'private_photo' then 25 when 'vault3' then 15 when 'message' then 10 else null end;
  if v_coins is null then raise exception 'Unknown goal'; end if;
  insert into public.fv_wallets(user_id,timezone) values(v_uid,'UTC') on conflict do nothing;
  select * into v_wallet from public.fv_wallets where user_id=v_uid for update;
  v_week:=to_char(timezone(v_wallet.timezone,now()),'IYYY-"W"IW');
  v_week_start:=date_trunc('week',timezone(v_wallet.timezone,now()))::date;

  if p_goal_id='mood' then
    select exists(
      select 1 from public.fv_activity_events e
      where e.user_id=v_uid and e.event_type='mood'
        and timezone(v_wallet.timezone,e.created_at)::date >= v_week_start
    ) into v_eligible;
  elsif p_goal_id='private_photo' then
    select exists(
      select 1 from public.fv_private_album_photos a
      where a.owner_id=v_uid and timezone(v_wallet.timezone,a.created_at)::date >= v_week_start
    ) into v_eligible;
  elsif p_goal_id='vault3' then
    select count(distinct e.event_key)>=3 into v_eligible
    from public.fv_activity_events e
    where e.user_id=v_uid and e.event_type='vault_rating'
      and timezone(v_wallet.timezone,e.created_at)::date >= v_week_start;
  elsif p_goal_id='message' then
    select exists(
      select 1 from public.fv_messages m
      where m.sender_id=v_uid and timezone(v_wallet.timezone,m.created_at)::date >= v_week_start
    ) into v_eligible;
  end if;

  if not v_eligible then raise exception 'Weekly goal requirements not met'; end if;

  insert into public.fv_weekly_goal_claims(user_id,week_key,goal_id,coins)
  values(v_uid,v_week,p_goal_id,v_coins) on conflict do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    return jsonb_build_object('status','already_claimed','week_key',v_week,'coins',0,'economy',public.fv_economy_json(v_uid));
  end if;
  update public.fv_wallets set glow_coins=glow_coins+v_coins,lifetime_earned=lifetime_earned+v_coins,updated_at=now()
  where user_id=v_uid returning * into v_wallet;
  insert into public.fv_wallet_ledger(user_id,amount,balance_after,entry_type,source_key,metadata)
  values(v_uid,v_coins,v_wallet.glow_coins,'weekly_goal','weekly:'||v_week||':'||p_goal_id,jsonb_build_object('goal_id',p_goal_id,'week_key',v_week))
  on conflict (user_id,source_key) do nothing;
  return jsonb_build_object('status','claimed','week_key',v_week,'coins',v_coins,'economy',public.fv_economy_json(v_uid));
end;
$$;

create or replace function public.fv_purchase_shop_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid:=auth.uid();
  v_item public.fv_shop_items%rowtype;
  v_wallet public.fv_wallets%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_item from public.fv_shop_items where item_id=p_item_id and active=true;
  if not found then raise exception 'Item unavailable'; end if;
  insert into public.fv_wallets(user_id,timezone) values(v_uid,'UTC') on conflict do nothing;
  select * into v_wallet from public.fv_wallets where user_id=v_uid for update;
  if exists(select 1 from public.fv_user_inventory where user_id=v_uid and item_id=p_item_id) then
    return jsonb_build_object('status','owned','economy',public.fv_economy_json(v_uid));
  end if;
  if v_wallet.glow_coins<v_item.price then
    return jsonb_build_object('status','insufficient','needed',v_item.price-v_wallet.glow_coins,'economy',public.fv_economy_json(v_uid));
  end if;
  update public.fv_wallets set glow_coins=glow_coins-v_item.price,lifetime_spent=lifetime_spent+v_item.price,updated_at=now()
  where user_id=v_uid returning * into v_wallet;
  insert into public.fv_user_inventory(user_id,item_id) values(v_uid,p_item_id);
  insert into public.fv_wallet_ledger(user_id,amount,balance_after,entry_type,source_key,metadata)
  values(v_uid,-v_item.price,v_wallet.glow_coins,'shop_purchase','purchase:'||p_item_id,jsonb_build_object('item_id',p_item_id,'price',v_item.price))
  on conflict (user_id,source_key) do nothing;
  return jsonb_build_object('status','purchased','item_id',p_item_id,'economy',public.fv_economy_json(v_uid));
end;
$$;

create or replace function public.fv_equip_shop_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid:=auth.uid();
  v_item public.fv_shop_items%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  -- Serialize equipment changes per user. Because direct inventory writes are
  -- revoked below, this wallet-row lock guarantees one equipped item per type
  -- even when two devices equip at the same moment.
  insert into public.fv_wallets(user_id,timezone) values(v_uid,'UTC') on conflict do nothing;
  perform 1 from public.fv_wallets where user_id=v_uid for update;
  select s.* into v_item from public.fv_shop_items s
  join public.fv_user_inventory ui on ui.item_id=s.item_id and ui.user_id=v_uid
  where s.item_id=p_item_id;
  if not found then raise exception 'Item is not owned'; end if;
  update public.fv_user_inventory ui set equipped=false,equipped_at=null
  from public.fv_shop_items s where ui.user_id=v_uid and ui.item_id=s.item_id and s.item_type=v_item.item_type;
  update public.fv_user_inventory set equipped=true,equipped_at=now() where user_id=v_uid and item_id=p_item_id;
  return jsonb_build_object('status','equipped','item_id',p_item_id,'economy',public.fv_economy_json(v_uid));
end;
$$;

create or replace function public.fv_admin_list_users(p_limit integer default 250)
returns table(user_id uuid,email text,profile jsonb,updated_at timestamptz,glow_coins integer,streak integer,last_claim_date date)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fv_is_admin() then raise exception 'Admin access required'; end if;
  return query select p.user_id,p.email,
    coalesce(p.profile,'{}'::jsonb) || case when rr.user_id is null then '{}'::jsonb else jsonb_build_object('_walletRecovery',to_jsonb(rr)-'user_id') end,
    p.updated_at,coalesce(w.glow_coins,0),coalesce(w.streak,0),w.last_claim_date
  from public.fv_profiles p
  left join public.fv_wallets w on w.user_id=p.user_id
  left join public.fv_wallet_recovery_requests rr on rr.user_id=p.user_id
  order by p.updated_at desc limit least(greatest(coalesce(p_limit,250),1),1000);
end;
$$;

create or replace function public.fv_admin_adjust_glow_coins(p_user_id uuid,p_amount integer,p_set_exact boolean default false,p_reason text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.fv_wallets%rowtype;
  v_before integer;
  v_after integer;
  v_delta integer;
  v_key text;
begin
  if not public.fv_is_admin() then raise exception 'Admin access required'; end if;
  insert into public.fv_wallets(user_id,timezone) values(p_user_id,'UTC') on conflict do nothing;
  select * into v_wallet from public.fv_wallets where user_id=p_user_id for update;
  v_before:=v_wallet.glow_coins;
  v_after:=greatest(0,case when p_set_exact then p_amount else v_before+p_amount end);
  v_delta:=v_after-v_before;
  update public.fv_wallets set glow_coins=v_after,
    lifetime_earned=lifetime_earned+greatest(v_delta,0),lifetime_spent=lifetime_spent+greatest(-v_delta,0),updated_at=now()
  where user_id=p_user_id returning * into v_wallet;
  v_key:='admin:'||gen_random_uuid()::text;
  insert into public.fv_wallet_ledger(user_id,amount,balance_after,entry_type,source_key,metadata)
  values(p_user_id,v_delta,v_after,'admin_adjustment',v_key,jsonb_build_object('reason',left(coalesce(p_reason,''),300),'admin_email',auth.jwt()->>'email','set_exact',p_set_exact));
  return jsonb_build_object('status','adjusted','delta',v_delta,'economy',public.fv_economy_json(p_user_id));
end;
$$;

create or replace function public.fv_admin_resolve_wallet_recovery(
  p_user_id uuid,
  p_approve boolean,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.fv_wallet_recovery_requests%rowtype;
  v_wallet public.fv_wallets%rowtype;
  v_delta integer:=0;
  v_target integer;
begin
  if not public.fv_is_admin() then raise exception 'Admin access required'; end if;
  select * into v_request from public.fv_wallet_recovery_requests where user_id=p_user_id for update;
  if not found then raise exception 'Recovery request not found'; end if;
  if v_request.status<>'pending' then raise exception 'Recovery request is already resolved'; end if;

  insert into public.fv_wallets(user_id,timezone) values(p_user_id,'UTC') on conflict do nothing;
  select * into v_wallet from public.fv_wallets where user_id=p_user_id for update;

  if p_approve then
    v_target:=greatest(v_wallet.glow_coins,v_request.requested_balance);
    v_delta:=v_target-v_wallet.glow_coins;
    update public.fv_wallets set glow_coins=v_target,lifetime_earned=lifetime_earned+v_delta,updated_at=now()
    where user_id=p_user_id returning * into v_wallet;
    if v_delta>0 then
      insert into public.fv_wallet_ledger(user_id,amount,balance_after,entry_type,source_key,metadata)
      values(p_user_id,v_delta,v_target,'wallet_recovery','wallet_recovery:'||v_request.id::text||':'||gen_random_uuid()::text,
        jsonb_build_object('requested_balance',v_request.requested_balance,'server_balance_at_request',v_request.server_balance_at_request,'admin_email',auth.jwt()->>'email'))
      on conflict(user_id,source_key) do nothing;
    end if;
  end if;

  update public.fv_wallet_recovery_requests set status=case when p_approve then 'approved' else 'rejected' end,
    resolved_at=now(),resolved_by=auth.jwt()->>'email',resolution_note=left(coalesce(p_note,''),500),updated_at=now()
  where user_id=p_user_id returning * into v_request;

  return jsonb_build_object('status',v_request.status,'delta',v_delta,'request',to_jsonb(v_request),'economy',public.fv_economy_json(p_user_id));
end;
$$;

grant execute on function public.fv_get_my_economy() to authenticated;
grant execute on function public.fv_request_wallet_recovery(integer,date,integer,jsonb) to authenticated;
grant execute on function public.fv_claim_daily_glow(text) to authenticated;
grant execute on function public.fv_claim_weekly_goal(text) to authenticated;
grant execute on function public.fv_purchase_shop_item(text) to authenticated;
grant execute on function public.fv_equip_shop_item(text) to authenticated;
grant execute on function public.fv_admin_list_users(integer) to authenticated;
grant execute on function public.fv_admin_adjust_glow_coins(uuid,integer,boolean,text) to authenticated;
grant execute on function public.fv_admin_resolve_wallet_recovery(uuid,boolean,text) to authenticated;

-- Wallet data is now authoritative outside profile JSON.
update public.fv_profiles
set profile = coalesce(profile,'{}'::jsonb) - 'rewards' - 'weeklyGoals' - 'inventory';

-- ---------------------------------------------------------------------------
-- Private chat-media authorization and cleanup
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can sign Fantasy Vault chat media" on storage.objects;
drop policy if exists "Participants can sign Afterglow private chat media" on storage.objects;
create policy "Participants can sign Afterglow private chat media"
on storage.objects for select to authenticated
using(
  bucket_id='fv-private-chat' and (
    (storage.foldername(name))[1]=auth.uid()::text
    or exists(
      select 1
      from public.fv_messages m
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(coalesce(m.media,'[]'::jsonb))='array' then m.media else '[]'::jsonb end
      ) item(value)
      where m.expires_at>now()
        and (m.sender_id=auth.uid() or m.recipient_id=auth.uid())
        and item.value->>'path'=storage.objects.name
    )
  )
);

create or replace function public.fv_my_expired_media_paths()
returns table(path text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct item.value->>'path' as path
  from public.fv_messages m
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(coalesce(m.media,'[]'::jsonb))='array' then m.media else '[]'::jsonb end
  ) item(value)
  where m.sender_id=auth.uid() and m.expires_at<=now() and coalesce(item.value->>'path','')<>'';
$$;

create or replace function public.fv_cleanup_my_expired_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid:=auth.uid();
  v_deleted integer:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  delete from public.fv_messages
  where expires_at<=now() and (sender_id=v_uid or recipient_id=v_uid);
  get diagnostics v_deleted=row_count;
  return v_deleted;
end;
$$;

create or replace function public.fv_my_conversation_media_paths(p_other_id uuid)
returns table(path text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct item.value->>'path' as path
  from public.fv_messages m
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(coalesce(m.media,'[]'::jsonb))='array' then m.media else '[]'::jsonb end
  ) item(value)
  where m.sender_id=auth.uid() and m.recipient_id=p_other_id and coalesce(item.value->>'path','')<>'';
$$;

create or replace function public.fv_delete_my_conversation(p_other_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid:=auth.uid();
  v_deleted integer:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_other_id is null or p_other_id=v_uid then raise exception 'Invalid conversation'; end if;
  delete from public.fv_messages
  where (sender_id=v_uid and recipient_id=p_other_id) or (sender_id=p_other_id and recipient_id=v_uid);
  get diagnostics v_deleted=row_count;
  return v_deleted;
end;
$$;

grant execute on function public.fv_my_expired_media_paths() to authenticated;
grant execute on function public.fv_cleanup_my_expired_messages() to authenticated;
grant execute on function public.fv_my_conversation_media_paths(uuid) to authenticated;
grant execute on function public.fv_delete_my_conversation(uuid) to authenticated;

-- Direct chat writes are valid only between mutual matches. This prevents a
-- modified browser from messaging arbitrary user IDs or attaching another
-- user's storage paths. Album requests are inserted atomically by the RPC below.
drop policy if exists "Users can send Fantasy Vault messages" on public.fv_messages;
create policy "Users can send Fantasy Vault messages"
on public.fv_messages for insert to authenticated
with check(
  auth.uid()=sender_id
  and sender_id<>recipient_id
  and conversation_id=least(sender_id::text,recipient_id::text)||'__'||greatest(sender_id::text,recipient_id::text)
  and expires_at>now() and expires_at<=now()+interval '72 hours 5 minutes'
  and message_type in ('text','photo')
  and exists(
    select 1
    from public.fv_profiles sender
    join public.fv_profiles recipient on recipient.user_id=fv_messages.recipient_id
    where sender.user_id=auth.uid()
      and coalesce(sender.liked,'[]'::jsonb) ? fv_messages.recipient_id::text
      and coalesce(recipient.liked,'[]'::jsonb) ? auth.uid()::text
  )
  and (
    (
      message_type='text'
      and body is not null and char_length(trim(body)) between 1 and 500
      and coalesce(media,'[]'::jsonb)='[]'::jsonb
    )
    or (
      message_type='photo'
      and (body is null or char_length(body)<=500)
      and jsonb_typeof(coalesce(media,'[]'::jsonb))='array'
      and jsonb_array_length(case when jsonb_typeof(coalesce(media,'[]'::jsonb))='array' then media else '[]'::jsonb end) between 1 and 8
      and not exists(
        select 1 from jsonb_array_elements(case when jsonb_typeof(coalesce(media,'[]'::jsonb))='array' then media else '[]'::jsonb end) item(value)
        where jsonb_typeof(item.value)<>'object'
          or coalesce(item.value->>'path','') not like auth.uid()::text||'/%'
          or coalesce(item.value->>'type','') not like 'image/%'
      )
    )
  )
);

-- ---------------------------------------------------------------------------
-- Durable private-album permissions and storage enforcement
-- ---------------------------------------------------------------------------
create table if not exists public.fv_album_access (
  owner_id uuid not null references auth.users(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','denied','revoked')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(owner_id,requester_id),
  check(owner_id<>requester_id)
);

alter table public.fv_album_access enable row level security;
drop policy if exists "Album participants can read access" on public.fv_album_access;
drop policy if exists "Requesters can request album access" on public.fv_album_access;
drop policy if exists "Owners can update album access" on public.fv_album_access;
create policy "Album participants can read access" on public.fv_album_access for select to authenticated
using(auth.uid()=owner_id or auth.uid()=requester_id);
create policy "Requesters can request album access" on public.fv_album_access for insert to authenticated
with check(auth.uid()=requester_id and status='pending');
create policy "Owners can update album access" on public.fv_album_access for update to authenticated
using(auth.uid()=owner_id) with check(auth.uid()=owner_id);

grant select,insert,update on public.fv_album_access to authenticated;

-- Preserve accepted/pending requests that still exist in legacy message rows.
insert into public.fv_album_access(owner_id,requester_id,status,requested_at,responded_at,updated_at)
select (x.value->>'owner_id')::uuid,(x.value->>'requester_id')::uuid,
  case when x.value->>'status' in ('pending','accepted','denied','revoked') then x.value->>'status' else 'pending' end,
  m.created_at,
  case when x.value->>'status' in ('accepted','denied','revoked') then coalesce((x.value->>'responded_at')::timestamptz,m.created_at) else null end,
  m.created_at
from public.fv_messages m
cross join lateral jsonb_array_elements(case when jsonb_typeof(m.media)='array' then m.media else '[]'::jsonb end) x(value)
where x.value->>'kind'='album_request'
  and coalesce(x.value->>'owner_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and coalesce(x.value->>'requester_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
on conflict(owner_id,requester_id) do update set
 status=excluded.status,responded_at=excluded.responded_at,updated_at=greatest(public.fv_album_access.updated_at,excluded.updated_at);

create or replace function public.fv_request_album_access(p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid:=auth.uid();
  v_message_id uuid;
  v_conversation text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_owner_id=v_uid then raise exception 'Cannot request your own album'; end if;
  if not exists (
    select 1
    from public.fv_profiles requester
    join public.fv_profiles owner on owner.user_id=p_owner_id
    where requester.user_id=v_uid
      and coalesce(requester.liked,'[]'::jsonb) ? p_owner_id::text
      and coalesce(owner.liked,'[]'::jsonb) ? v_uid::text
  ) then
    raise exception 'Private album access requires a mutual match';
  end if;

  insert into public.fv_album_access(owner_id,requester_id,status,requested_at,responded_at,updated_at)
  values(p_owner_id,v_uid,'pending',now(),null,now())
  on conflict(owner_id,requester_id) do update set status='pending',requested_at=now(),responded_at=null,updated_at=now();

  select m.id into v_message_id
  from public.fv_messages m
  where m.sender_id=v_uid and m.recipient_id=p_owner_id
    and m.message_type='album_request' and m.expires_at>now()
    and exists(
      select 1 from jsonb_array_elements(
        case when jsonb_typeof(coalesce(m.media,'[]'::jsonb))='array' then m.media else '[]'::jsonb end
      ) x(value)
      where x.value->>'kind'='album_request'
        and x.value->>'owner_id'=p_owner_id::text
        and x.value->>'requester_id'=v_uid::text
        and coalesce(x.value->>'status','pending')='pending'
    )
  order by m.created_at desc limit 1;

  if v_message_id is null then
    v_conversation:=least(v_uid::text,p_owner_id::text)||'__'||greatest(v_uid::text,p_owner_id::text);
    insert into public.fv_messages(
      sender_id,recipient_id,conversation_id,body,message_type,media,expires_at,retention_hours
    ) values (
      v_uid,p_owner_id,v_conversation,'🔒 Private album access request','album_request',
      jsonb_build_array(jsonb_build_object(
        'kind','album_request','owner_id',p_owner_id,'requester_id',v_uid,
        'status','pending','created_at',now()
      )),
      now()+interval '72 hours',72
    ) returning id into v_message_id;
  end if;

  return jsonb_build_object(
    'status','pending','owner_id',p_owner_id,'requester_id',v_uid,'message_id',v_message_id
  );
end;
$$;

create or replace function public.fv_respond_album_access(p_requester_id uuid,p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid:=auth.uid();
  v_previous text;
  v_conversation text;
  v_messages_updated integer:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_status not in ('accepted','denied','revoked') then raise exception 'Invalid status'; end if;

  select status into v_previous
  from public.fv_album_access
  where owner_id=v_uid and requester_id=p_requester_id
  for update;
  if not found then raise exception 'Album request not found'; end if;

  update public.fv_album_access
  set status=p_status,responded_at=now(),updated_at=now()
  where owner_id=v_uid and requester_id=p_requester_id;

  update public.fv_messages m
  set media=(
      select coalesce(jsonb_agg(
        case when x.value->>'kind'='album_request'
          and x.value->>'owner_id'=v_uid::text
          and x.value->>'requester_id'=p_requester_id::text
        then jsonb_set(
          jsonb_set(x.value,'{status}',to_jsonb(p_status::text),true),
          '{responded_at}',to_jsonb(now()),true
        )
        else x.value end
        order by x.ordinality
      ),'[]'::jsonb)
      from jsonb_array_elements(
        case when jsonb_typeof(coalesce(m.media,'[]'::jsonb))='array' then m.media else '[]'::jsonb end
      ) with ordinality x(value,ordinality)
    ),
    body=case when p_status='accepted' then '✅ Private album access approved'
              when p_status='denied' then '🚫 Private album access denied'
              else '🔒 Private album access revoked' end
  where m.message_type='album_request'
    and ((m.sender_id=p_requester_id and m.recipient_id=v_uid)
      or (m.sender_id=v_uid and m.recipient_id=p_requester_id))
    and exists(
      select 1 from jsonb_array_elements(
        case when jsonb_typeof(coalesce(m.media,'[]'::jsonb))='array' then m.media else '[]'::jsonb end
      ) x(value)
      where x.value->>'kind'='album_request'
        and x.value->>'owner_id'=v_uid::text
        and x.value->>'requester_id'=p_requester_id::text
    );
  get diagnostics v_messages_updated=row_count;

  if v_previous is distinct from p_status then
    v_conversation:=least(v_uid::text,p_requester_id::text)||'__'||greatest(v_uid::text,p_requester_id::text);
    insert into public.fv_messages(
      sender_id,recipient_id,conversation_id,body,message_type,media,expires_at,retention_hours
    ) values (
      v_uid,p_requester_id,v_conversation,
      case when p_status='accepted' then '✅ Private album access approved'
           when p_status='denied' then '🚫 Private album access denied'
           else '🔒 Private album access revoked' end,
      'text','[]'::jsonb,now()+interval '72 hours',72
    );
  end if;

  return jsonb_build_object(
    'status',p_status,'owner_id',v_uid,'requester_id',p_requester_id,
    'messages_updated',v_messages_updated
  );
end;
$$;

grant execute on function public.fv_request_album_access(uuid) to authenticated;
grant execute on function public.fv_respond_album_access(uuid,text) to authenticated;

-- All album-request mutations now occur inside the protected RPC above.
-- Browser clients may not rewrite participants, media permissions, or status.
drop policy if exists "Users can update Afterglow album request messages" on public.fv_messages;
revoke update on public.fv_messages from authenticated, anon;

-- Metadata and object bytes are now visible only to the owner or an accepted requester.
drop policy if exists "Users can read private album metadata" on public.fv_private_album_photos;
drop policy if exists "Users can read authorized private album photos" on public.fv_private_album_photos;
create policy "Users can read authorized private album photos"
on public.fv_private_album_photos for select to authenticated
using(
  auth.uid()=owner_id or exists(
    select 1 from public.fv_album_access a
    where a.owner_id=fv_private_album_photos.owner_id and a.requester_id=auth.uid() and a.status='accepted'
  )
);

drop policy if exists "Authenticated users can sign Afterglow private album" on storage.objects;
drop policy if exists "Authorized users can sign Afterglow private album" on storage.objects;
create policy "Authorized users can sign Afterglow private album"
on storage.objects for select to authenticated
using(
  bucket_id='fv-private-albums' and (
    (storage.foldername(name))[1]=auth.uid()::text
    or exists(
      select 1 from public.fv_album_access a
      where a.owner_id::text=(storage.foldername(name))[1]
        and a.requester_id=auth.uid() and a.status='accepted'
    )
  )
);

create or replace function public.fv_private_album_preview_count(p_owner_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return (select count(*)::integer from public.fv_private_album_photos where owner_id=p_owner_id);
end;
$$;

grant execute on function public.fv_private_album_preview_count(uuid) to authenticated;

-- Helpful health view for the owner. It contains counts only, never private payloads.
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

-- Manual owner export of the durable database state. Storage object bytes are
-- intentionally excluded; they should be covered by the storage/provider backup.
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
    'format','afterglow-server-backup-v1',
    'generated_at',now(),
    'profiles',coalesce((select jsonb_agg(to_jsonb(x) order by x.user_id) from public.fv_profiles x),'[]'::jsonb),
    'wallets',coalesce((select jsonb_agg(to_jsonb(x) order by x.user_id) from public.fv_wallets x),'[]'::jsonb),
    'wallet_ledger',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.fv_wallet_ledger x),'[]'::jsonb),
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

-- ---------------------------------------------------------------------------
-- Final privilege lock-down
-- ---------------------------------------------------------------------------
-- Old cached clients must not bypass revision/conflict protection with direct
-- profile writes. The current app writes through fv_save_my_state().
revoke insert,update,delete on public.fv_profiles from authenticated,anon;
grant select on public.fv_profiles to authenticated;

-- Economy/revision tables are read-only to browsers. Every mutation is an
-- atomic security-definer function, even if a future RLS policy is misedited.
revoke insert,update,delete on public.fv_profile_revisions from authenticated,anon;
revoke insert,update,delete on public.fv_wallets from authenticated,anon;
revoke insert,update,delete on public.fv_wallet_ledger from authenticated,anon;
revoke insert,update,delete on public.fv_shop_items from authenticated,anon;
revoke insert,update,delete on public.fv_user_inventory from authenticated,anon;
revoke insert,update,delete on public.fv_weekly_goal_claims from authenticated,anon;
revoke insert,update,delete on public.fv_activity_events from authenticated,anon;

-- Album permission changes must pass the mutual-match and owner checks in RPCs.
revoke insert,update,delete on public.fv_album_access from authenticated,anon;
grant select on public.fv_album_access to authenticated;
revoke insert,update,delete on public.fv_wallet_recovery_requests from authenticated,anon;
grant select on public.fv_wallet_recovery_requests to authenticated;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Remove that
-- default from every security-definer entry point, then grant signed-in users.
revoke all on function public.fv_save_my_state(jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,timestamptz,text,integer,text,bigint) from public,anon;
revoke all on function public.fv_restore_my_revision(uuid) from public,anon;
revoke all on function public.fv_get_directory(integer) from public,anon;
revoke all on function public.fv_get_my_economy() from public,anon;
revoke all on function public.fv_request_wallet_recovery(integer,date,integer,jsonb) from public,anon;
revoke all on function public.fv_claim_daily_glow(text) from public,anon;
revoke all on function public.fv_claim_weekly_goal(text) from public,anon;
revoke all on function public.fv_purchase_shop_item(text) from public,anon;
revoke all on function public.fv_equip_shop_item(text) from public,anon;
revoke all on function public.fv_admin_list_users(integer) from public,anon;
revoke all on function public.fv_admin_adjust_glow_coins(uuid,integer,boolean,text) from public,anon;
revoke all on function public.fv_admin_resolve_wallet_recovery(uuid,boolean,text) from public,anon;
revoke all on function public.fv_my_expired_media_paths() from public,anon;
revoke all on function public.fv_cleanup_my_expired_messages() from public,anon;
revoke all on function public.fv_my_conversation_media_paths(uuid) from public,anon;
revoke all on function public.fv_delete_my_conversation(uuid) from public,anon;
revoke all on function public.fv_request_album_access(uuid) from public,anon;
revoke all on function public.fv_respond_album_access(uuid,text) from public,anon;
revoke all on function public.fv_private_album_preview_count(uuid) from public,anon;
revoke all on function public.fv_admin_health_summary() from public,anon;
revoke all on function public.fv_admin_export_backup() from public,anon;

commit;
