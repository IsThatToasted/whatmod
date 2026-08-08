-- ============================================================
-- WeTrack V2.9.2 RECOVERY — account onboarding + packing safety
-- Safe to rerun. Does NOT write NULL trip_id into legacy profile tables.
-- IMPORTANT: this intentionally leaves public.itinerary_user_profiles as
-- a legacy/trip-scoped table because older WeTrack deployments used trip_id.
-- ============================================================

begin;

-- 0) Undo the incorrect V2.9/V2.9.1 assumption that itinerary_user_profiles
--    was account-wide. A user may legitimately have one row per trip there.
drop index if exists public.itinerary_user_profiles_user_id_uidx;

-- Ensure the trip-member completion flag exists for compatibility/backfill.
alter table public.itinerary_trip_members
  add column if not exists onboarding_completed boolean not null default false;

-- 1) NEW account-wide profile table. It is deliberately a different name
--    so it can coexist with old trip-scoped itinerary_user_profiles schemas.
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

alter table public.wetrack_account_profiles
  add column if not exists display_name text,
  add column if not exists trip_role text default 'Traveler',
  add column if not exists favorite_foods text,
  add column if not exists favorite_activities text,
  add column if not exists personal_interests text,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.wetrack_account_profiles enable row level security;
grant select,insert,update on public.wetrack_account_profiles to authenticated;

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

-- 2) Backfill from the current trip-member records first. No ON CONFLICT.
update public.wetrack_account_profiles p
set onboarding_completed = p.onboarding_completed or coalesce(m.onboarding_completed,false),
    display_name = coalesce(nullif(p.display_name,''), nullif(m.display_name,'')),
    trip_role = coalesce(nullif(p.trip_role,''), nullif(m.trip_role,''), 'Traveler'),
    favorite_foods = coalesce(nullif(p.favorite_foods,''), nullif(m.favorite_foods,'')),
    favorite_activities = coalesce(nullif(p.favorite_activities,''), nullif(m.favorite_activities,'')),
    personal_interests = coalesce(nullif(p.personal_interests,''), nullif(m.personal_interests,'')),
    updated_at = now()
from (
  select distinct on (user_id)
    user_id, display_name, trip_role, favorite_foods, favorite_activities,
    personal_interests, onboarding_completed
  from public.itinerary_trip_members
  where user_id is not null
  order by user_id, coalesce(onboarding_completed,false) desc, created_at desc nulls last
) m
where p.user_id = m.user_id;

insert into public.wetrack_account_profiles(
  user_id,display_name,trip_role,favorite_foods,favorite_activities,
  personal_interests,onboarding_completed,updated_at
)
select m.user_id,m.display_name,coalesce(nullif(m.trip_role,''),'Traveler'),
       m.favorite_foods,m.favorite_activities,m.personal_interests,
       coalesce(m.onboarding_completed,false),now()
from (
  select distinct on (user_id)
    user_id, display_name, trip_role, favorite_foods, favorite_activities,
    personal_interests, onboarding_completed
  from public.itinerary_trip_members
  where user_id is not null
  order by user_id, coalesce(onboarding_completed,false) desc, created_at desc nulls last
) m
where not exists (
  select 1 from public.wetrack_account_profiles p where p.user_id=m.user_id
);

-- 3) If the legacy itinerary_user_profiles table has the known trip-scoped
--    columns, use its newest completed record to enrich the new account table.
--    Dynamic SQL keeps this safe across historical schema variants.
do $$
begin
  if to_regclass('public.itinerary_user_profiles') is not null
     and exists(select 1 from information_schema.columns where table_schema='public' and table_name='itinerary_user_profiles' and column_name='user_id')
     and exists(select 1 from information_schema.columns where table_schema='public' and table_name='itinerary_user_profiles' and column_name='onboarding_completed') then
    execute $sql$
      update public.wetrack_account_profiles p
      set onboarding_completed = p.onboarding_completed or coalesce(x.onboarding_completed,false),
          display_name = coalesce(nullif(p.display_name,''),nullif(x.display_name,'')),
          trip_role = coalesce(nullif(p.trip_role,''),nullif(x.trip_role,''),'Traveler'),
          favorite_foods = coalesce(nullif(p.favorite_foods,''),nullif(x.favorite_foods,'')),
          favorite_activities = coalesce(nullif(p.favorite_activities,''),nullif(x.favorite_activities,'')),
          personal_interests = coalesce(nullif(p.personal_interests,''),nullif(x.personal_interests,'')),
          updated_at = now()
      from (
        select distinct on(user_id)
          user_id, display_name, trip_role, favorite_foods, favorite_activities,
          personal_interests, onboarding_completed
        from public.itinerary_user_profiles
        where user_id is not null
        order by user_id, coalesce(onboarding_completed,false) desc, updated_at desc nulls last, created_at desc nulls last
      ) x
      where p.user_id=x.user_id
    $sql$;

    execute $sql$
      insert into public.wetrack_account_profiles(
        user_id,display_name,trip_role,favorite_foods,favorite_activities,
        personal_interests,onboarding_completed,updated_at
      )
      select x.user_id,x.display_name,coalesce(nullif(x.trip_role,''),'Traveler'),
             x.favorite_foods,x.favorite_activities,x.personal_interests,
             coalesce(x.onboarding_completed,false),now()
      from (
        select distinct on(user_id)
          user_id, display_name, trip_role, favorite_foods, favorite_activities,
          personal_interests, onboarding_completed
        from public.itinerary_user_profiles
        where user_id is not null
        order by user_id, coalesce(onboarding_completed,false) desc, updated_at desc nulls last, created_at desc nulls last
      ) x
      where not exists(select 1 from public.wetrack_account_profiles p where p.user_id=x.user_id)
    $sql$;
  end if;
exception when undefined_column then
  raise notice 'Legacy itinerary_user_profiles differs from expected shape; skipped optional profile backfill.';
end $$;

-- 4) Clean duplicate BUILT-IN starter packing rows only. Custom items untouched.
with agg as (
  select trip_id,user_id,lower(trim(label)) norm_label,bool_or(packed) any_packed
  from public.itinerary_packing_items
  where lower(trim(label)) in ('clothing','toiletries','chargers','medications','swimwear','comfort items','snacks','travel documents')
  group by trip_id,user_id,lower(trim(label)) having count(*)>1
), keepers as (
  select distinct on(p.trip_id,p.user_id,lower(trim(p.label))) p.id,a.any_packed
  from public.itinerary_packing_items p join agg a
    on a.trip_id=p.trip_id and a.user_id=p.user_id and a.norm_label=lower(trim(p.label))
  order by p.trip_id,p.user_id,lower(trim(p.label)),p.created_at,p.id
)
update public.itinerary_packing_items p
set packed=k.any_packed,updated_at=now()
from keepers k where p.id=k.id;

with ranked as (
  select id,row_number() over(
    partition by trip_id,user_id,lower(trim(label)) order by created_at,id
  ) rn
  from public.itinerary_packing_items
  where lower(trim(label)) in ('clothing','toiletries','chargers','medications','swimwear','comfort items','snacks','travel documents')
)
delete from public.itinerary_packing_items p
using ranked r where p.id=r.id and r.rn>1;

create unique index if not exists itinerary_packing_starter_unique_idx
on public.itinerary_packing_items(trip_id,user_id,lower(trim(label)))
where lower(trim(label)) in ('clothing','toiletries','chargers','medications','swimwear','comfort items','snacks','travel documents');

-- 5) Transactional idempotent starter seeder.
create or replace function public.ensure_itinerary_starter_packing(target_trip_id uuid)
returns setof public.itinerary_packing_items
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.user_can_edit_trip(target_trip_id) then
    raise exception 'Not authorized to seed packing for this trip';
  end if;
  perform pg_advisory_xact_lock(hashtext(target_trip_id::text || ':' || auth.uid()::text || ':packing'));
  insert into public.itinerary_packing_items(trip_id,user_id,label,packed,sort_order)
  select target_trip_id,auth.uid(),v.label,false,v.ord
  from (values
    ('Clothing',0),('Toiletries',1),('Chargers',2),('Medications',3),
    ('Swimwear',4),('Comfort items',5),('Snacks',6),('Travel documents',7)
  ) v(label,ord)
  where not exists (
    select 1 from public.itinerary_packing_items p
    where p.trip_id=target_trip_id and p.user_id=auth.uid()
      and lower(trim(p.label))=lower(v.label)
  );
  return query select p.* from public.itinerary_packing_items p
    where p.trip_id=target_trip_id and p.user_id=auth.uid()
    order by p.sort_order,p.created_at;
end; $$;
grant execute on function public.ensure_itinerary_starter_packing(uuid) to authenticated;

commit;
notify pgrst,'reload schema';

-- Verification only
select 'account_profiles' check_name,count(*) total,
       count(*) filter(where onboarding_completed) completed
from public.wetrack_account_profiles;
select 'duplicate_starter_packing_groups' check_name,count(*) problems
from (
  select trip_id,user_id,lower(trim(label))
  from public.itinerary_packing_items
  where lower(trim(label)) in ('clothing','toiletries','chargers','medications','swimwear','comfort items','snacks','travel documents')
  group by trip_id,user_id,lower(trim(label)) having count(*)>1
) x;
