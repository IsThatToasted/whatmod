-- Aurelium Field v0.15.0 · Exterior Smart Scanner v3
-- Apply after 014_member_permissions_exterior_release.sql. Additive only: one new table, no changes to existing tables,
-- auth, chat, payroll or permission objects. Safe to run more than once.
-- The iOS app treats this table as best-effort: if it is missing, scans still save and sync normally.

create table if not exists public.exterior_scan_details (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  walkthrough_id uuid not null references public.walkthrough_scans(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  wall_count integer not null default 0,
  stories integer not null default 1 check (stories between 1 and 12),
  surface text not null default '',
  condition text not null default '',
  perimeter_ft double precision not null default 0,
  gross_sqft double precision not null default 0,
  gable_sqft double precision not null default 0,
  openings_deducted_sqft double precision not null default 0,
  net_sqft double precision not null default 0,
  trim_lf double precision not null default 0,
  labor_hours double precision not null default 0,
  roof_slope_degrees double precision,
  loop_closed boolean not null default false,
  closure_error_ft double precision,
  confidence_score double precision check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  confidence_label text,
  heights_measured integer not null default 0,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (walkthrough_id)
);
create index if not exists exterior_scan_details_project_idx on public.exterior_scan_details(project_id, created_at desc);
create index if not exists exterior_scan_details_org_idx on public.exterior_scan_details(organization_id, created_at desc);
alter table public.exterior_scan_details enable row level security;

create or replace function public.populate_exterior_scan_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select p.organization_id into new.organization_id from public.projects p where p.id = new.project_id;
  if new.organization_id is null then raise exception 'Project not found'; end if;
  new.created_by := auth.uid();
  return new;
end; $$;

drop trigger if exists exterior_scan_populate_org on public.exterior_scan_details;
create trigger exterior_scan_populate_org before insert on public.exterior_scan_details
for each row execute function public.populate_exterior_scan_org();

drop policy if exists exterior_scan_member_select on public.exterior_scan_details;
create policy exterior_scan_member_select on public.exterior_scan_details for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists exterior_scan_member_insert on public.exterior_scan_details;
create policy exterior_scan_member_insert on public.exterior_scan_details for insert to authenticated
with check (
  auth.uid() is not null
  and exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organization_id))
  and exists (select 1 from public.walkthrough_scans w where w.id = walkthrough_id and w.captured_by = auth.uid())
);

drop policy if exists exterior_scan_admin_delete on public.exterior_scan_details;
create policy exterior_scan_admin_delete on public.exterior_scan_details for delete to authenticated
using (public.is_org_admin(organization_id));

grant select, insert, delete on public.exterior_scan_details to authenticated;
