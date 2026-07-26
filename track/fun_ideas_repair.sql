-- WeTrack V2.4 Fun Ideas verification / repair
-- Run the full schema.sql first. This script verifies the persistent tables and
-- removes only impossible stale category references from the persistent table.

do $$
begin
  if to_regclass('public.itinerary_fun_bucket_ideas') is null
     or to_regclass('public.itinerary_fun_bucket_categories') is null then
    raise exception 'Persistent Fun Ideas tables are missing. Run schema.sql first.';
  end if;
end $$;

update public.itinerary_fun_bucket_ideas i
set category_id = null, updated_at = now()
where category_id is not null
  and not exists (
    select 1
    from public.itinerary_fun_bucket_categories c
    where c.id = i.category_id
      and c.space_id = i.space_id
  );

select
  (select count(*) from public.itinerary_fun_bucket_ideas) as persistent_ideas,
  (select count(*) from public.itinerary_fun_bucket_categories) as persistent_categories;
