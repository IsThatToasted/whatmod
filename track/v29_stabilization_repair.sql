-- ============================================================
-- WeTrack V2.9 — onboarding persistence + packing idempotency
-- Safe to run repeatedly.
-- ============================================================

-- Backfill account-level onboarding completion for users who completed the
-- earlier trip-member onboarding flow before itinerary_user_profiles existed.
insert into public.itinerary_user_profiles (
  user_id, display_name, trip_role, favorite_foods, favorite_activities,
  personal_interests, onboarding_completed, updated_at
)
select distinct on (m.user_id)
  m.user_id,
  m.display_name,
  coalesce(m.trip_role, 'Traveler'),
  m.favorite_foods,
  m.favorite_activities,
  m.personal_interests,
  true,
  now()
from public.itinerary_trip_members m
where coalesce(m.onboarding_completed, false) is true
order by m.user_id, m.created_at desc
on conflict (user_id) do update set
  display_name = coalesce(excluded.display_name, public.itinerary_user_profiles.display_name),
  trip_role = coalesce(excluded.trip_role, public.itinerary_user_profiles.trip_role),
  favorite_foods = coalesce(excluded.favorite_foods, public.itinerary_user_profiles.favorite_foods),
  favorite_activities = coalesce(excluded.favorite_activities, public.itinerary_user_profiles.favorite_activities),
  personal_interests = coalesce(excluded.personal_interests, public.itinerary_user_profiles.personal_interests),
  onboarding_completed = public.itinerary_user_profiles.onboarding_completed or excluded.onboarding_completed,
  updated_at = now();

-- Clean only duplicate copies of the built-in starter packing rows. Custom
-- packing items are untouched. If one copy is checked, preserve that checked
-- state on the retained oldest row before removing duplicates.
with starter_dupes as (
  select trip_id, user_id, lower(trim(label)) as norm_label,
         min(created_at) as keep_created,
         bool_or(packed) as any_packed
  from public.itinerary_packing_items
  where lower(trim(label)) in (
    'clothing','toiletries','chargers','medications','swimwear',
    'comfort items','snacks','travel documents'
  )
  group by trip_id, user_id, lower(trim(label))
  having count(*) > 1
), keepers as (
  select distinct on (p.trip_id,p.user_id,lower(trim(p.label)))
    p.id, p.trip_id, p.user_id, lower(trim(p.label)) as norm_label, d.any_packed
  from public.itinerary_packing_items p
  join starter_dupes d
    on d.trip_id=p.trip_id and d.user_id=p.user_id
   and d.norm_label=lower(trim(p.label))
  order by p.trip_id,p.user_id,lower(trim(p.label)),p.created_at,p.id
)
update public.itinerary_packing_items p
set packed = k.any_packed, updated_at = now()
from keepers k
where p.id = k.id;

with ranked as (
  select id,
         row_number() over (
           partition by trip_id,user_id,lower(trim(label))
           order by created_at,id
         ) as rn
  from public.itinerary_packing_items
  where lower(trim(label)) in (
    'clothing','toiletries','chargers','medications','swimwear',
    'comfort items','snacks','travel documents'
  )
)
delete from public.itinerary_packing_items p
using ranked r
where p.id=r.id and r.rn>1;

-- Protect the starter rows from being duplicated by concurrent browser/app
-- loads. This deliberately applies only to the built-in starter labels.
create unique index if not exists itinerary_packing_starter_unique_idx
on public.itinerary_packing_items (trip_id, user_id, lower(trim(label)))
where lower(trim(label)) in (
  'clothing','toiletries','chargers','medications','swimwear',
  'comfort items','snacks','travel documents'
);

create or replace function public.ensure_itinerary_starter_packing(target_trip_id uuid)
returns setof public.itinerary_packing_items
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.user_can_edit_trip(target_trip_id) then
    raise exception 'Not authorized to seed packing for this trip';
  end if;

  -- Serialize starter seeding per trip/user, preventing simultaneous initial
  -- load and realtime refresh calls from both creating the starter set.
  perform pg_advisory_xact_lock(hashtext(target_trip_id::text || ':' || auth.uid()::text || ':packing'));

  insert into public.itinerary_packing_items (trip_id,user_id,label,packed,sort_order)
  select target_trip_id, auth.uid(), v.label, false, v.ord
  from (values
    ('Clothing',0),('Toiletries',1),('Chargers',2),('Medications',3),
    ('Swimwear',4),('Comfort items',5),('Snacks',6),('Travel documents',7)
  ) as v(label,ord)
  where not exists (
    select 1 from public.itinerary_packing_items p
    where p.trip_id=target_trip_id and p.user_id=auth.uid()
      and lower(trim(p.label))=lower(v.label)
  );

  return query
  select p.* from public.itinerary_packing_items p
  where p.trip_id=target_trip_id and p.user_id=auth.uid()
  order by p.sort_order,p.created_at;
end;
$$;

grant execute on function public.ensure_itinerary_starter_packing(uuid) to authenticated;

-- Correct an old realtime publication typo so Must Do changes genuinely sync.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='itinerary_must_do_items')
     and not exists (
       select 1 from pg_publication_tables
       where pubname='supabase_realtime' and schemaname='public' and tablename='itinerary_must_do_items'
     ) then
    alter publication supabase_realtime add table public.itinerary_must_do_items;
  end if;
exception when others then
  raise notice 'Could not add itinerary_must_do_items to realtime: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
