
-- WeTrack V3.4 — Slideshow soundtrack settings
-- Safe to run repeatedly.
alter table public.itinerary_trips
  add column if not exists slideshow_audio_type text not null default 'ambience',
  add column if not exists slideshow_audio_url text default '',
  add column if not exists slideshow_audio_path text default '',
  add column if not exists slideshow_youtube_url text default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'itinerary_trips_slideshow_audio_type_check'
  ) then
    alter table public.itinerary_trips
      add constraint itinerary_trips_slideshow_audio_type_check
      check (slideshow_audio_type in ('ambience','mp3','youtube','none'));
  end if;
end $$;

notify pgrst,'reload schema';
