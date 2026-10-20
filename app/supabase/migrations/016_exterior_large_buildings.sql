-- Aurelium Field v0.15.2 · large commercial exteriors. Apply after 015. Safe to run more than once.
-- Allows up to 12 stories in exterior scan details (015 originally capped at 3).
do $$
begin
  if to_regclass('public.exterior_scan_details') is not null then
    alter table public.exterior_scan_details drop constraint if exists exterior_scan_details_stories_check;
    alter table public.exterior_scan_details add constraint exterior_scan_details_stories_check check (stories between 1 and 12);
  end if;
end $$;
