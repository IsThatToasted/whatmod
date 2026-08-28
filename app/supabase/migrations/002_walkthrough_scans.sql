-- Smart Estimate walkthrough sessions. Apply after 001_initial.sql.
create table if not exists public.walkthrough_scans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  room_id uuid references public.estimate_rooms(id) on delete set null,
  captured_by uuid not null references auth.users(id) on delete restrict,
  transcript text not null default '',
  video_storage_path text,
  roomplan_payload jsonb,
  wall_count integer not null default 0 check(wall_count >= 0),
  door_count integer not null default 0 check(door_count >= 0),
  window_count integer not null default 0 check(window_count >= 0),
  duration_seconds numeric(10,2) check(duration_seconds is null or duration_seconds >= 0),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists walkthrough_scans_project_idx on public.walkthrough_scans(project_id, captured_at desc);
alter table public.walkthrough_scans enable row level security;
create policy walkthrough_scans_member_all on public.walkthrough_scans for all
  using(public.is_org_member(organization_id))
  with check(public.is_org_member(organization_id) and captured_by=auth.uid());

alter table public.project_media add column if not exists walkthrough_id uuid references public.walkthrough_scans(id) on delete cascade;
alter table public.project_media add column if not exists evidence_tag text check(evidence_tag is null or evidence_tag in ('DAMAGE','REMOVE','DO NOT DISTURB','COVER','PAINT'));
create index if not exists project_media_walkthrough_idx on public.project_media(walkthrough_id, captured_at);
