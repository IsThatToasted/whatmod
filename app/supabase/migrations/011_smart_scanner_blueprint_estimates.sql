-- Aurelium Field v0.11.0
-- Smart Scanner learning/correction telemetry + Blueprint Estimate analysis records.
-- Apply after 010_chat_rls_repair.sql. Preserves all existing records.

create table if not exists public.scanner_learning_samples (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  walkthrough_id uuid references public.walkthrough_scans(id) on delete set null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scan_mode text not null check (scan_mode in ('interior','exterior')),
  feature_kind text not null check (feature_kind in ('door','window','opening','roof_slope','wall')),
  correction_action text not null,
  predicted_count integer,
  corrected_count integer,
  predicted_width double precision,
  predicted_height double precision,
  corrected_width double precision,
  corrected_height double precision,
  corrected_slope_degrees double precision,
  confidence double precision check (confidence is null or (confidence >= 0 and confidence <= 1)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists scanner_learning_org_created_idx on public.scanner_learning_samples(organization_id,created_at desc);
create index if not exists scanner_learning_feature_idx on public.scanner_learning_samples(feature_kind,scan_mode);
alter table public.scanner_learning_samples enable row level security;

create or replace function public.populate_scanner_learning_org()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  select p.organization_id into new.organization_id from public.projects p where p.id=new.project_id;
  if new.organization_id is null then raise exception 'Project not found'; end if;
  new.user_id := auth.uid();
  return new;
end; $$;

drop trigger if exists scanner_learning_populate_org on public.scanner_learning_samples;
create trigger scanner_learning_populate_org before insert on public.scanner_learning_samples
for each row execute function public.populate_scanner_learning_org();

drop policy if exists scanner_learning_insert on public.scanner_learning_samples;
create policy scanner_learning_insert on public.scanner_learning_samples for insert to authenticated
with check (auth.uid() is not null and exists(select 1 from public.projects p where p.id=project_id and public.is_org_member(p.organization_id)));
drop policy if exists scanner_learning_select on public.scanner_learning_samples;
create policy scanner_learning_select on public.scanner_learning_samples for select to authenticated
using (user_id=auth.uid() or public.is_org_admin(organization_id));

create table if not exists public.blueprint_estimates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  file_name text not null,
  proposal_ready boolean not null default false,
  paintable_square_feet double precision not null default 0,
  labor_hours double precision not null default 0,
  notes text not null default '',
  status text not null default 'analysis' check(status in ('analysis','needs_review','ready','proposal_generated','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists blueprint_estimates_project_idx on public.blueprint_estimates(project_id,created_at desc);
alter table public.blueprint_estimates enable row level security;

create or replace function public.populate_blueprint_org()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  select p.organization_id into new.organization_id from public.projects p where p.id=new.project_id;
  if new.organization_id is null then raise exception 'Project not found'; end if;
  if tg_op='INSERT' then new.created_by := auth.uid(); end if;
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists blueprint_populate_org on public.blueprint_estimates;
create trigger blueprint_populate_org before insert or update on public.blueprint_estimates
for each row execute function public.populate_blueprint_org();

drop policy if exists blueprint_estimates_member_select on public.blueprint_estimates;
create policy blueprint_estimates_member_select on public.blueprint_estimates for select to authenticated
using (public.is_org_member(organization_id));
drop policy if exists blueprint_estimates_member_insert on public.blueprint_estimates;
create policy blueprint_estimates_member_insert on public.blueprint_estimates for insert to authenticated
with check (exists(select 1 from public.projects p where p.id=project_id and public.is_org_member(p.organization_id)));
drop policy if exists blueprint_estimates_owner_update on public.blueprint_estimates;
create policy blueprint_estimates_owner_update on public.blueprint_estimates for update to authenticated
using (created_by=auth.uid() or public.is_org_admin(organization_id))
with check (created_by=auth.uid() or public.is_org_admin(organization_id));

create table if not exists public.blueprint_pages (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references public.blueprint_estimates(id) on delete cascade,
  page_number integer not null check(page_number > 0),
  title text not null default '',
  recognized_text text not null default '',
  drawing_scale text,
  room_names text[] not null default '{}',
  finish_codes text[] not null default '{}',
  analysis_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(blueprint_id,page_number)
);
create index if not exists blueprint_pages_blueprint_idx on public.blueprint_pages(blueprint_id,page_number);
alter table public.blueprint_pages enable row level security;

drop policy if exists blueprint_pages_member_select on public.blueprint_pages;
create policy blueprint_pages_member_select on public.blueprint_pages for select to authenticated
using (exists(select 1 from public.blueprint_estimates b where b.id=blueprint_id and public.is_org_member(b.organization_id)));
drop policy if exists blueprint_pages_member_insert on public.blueprint_pages;
create policy blueprint_pages_member_insert on public.blueprint_pages for insert to authenticated
with check (exists(select 1 from public.blueprint_estimates b where b.id=blueprint_id and (b.created_by=auth.uid() or public.is_org_admin(b.organization_id))));
drop policy if exists blueprint_pages_member_update on public.blueprint_pages;
create policy blueprint_pages_member_update on public.blueprint_pages for update to authenticated
using (exists(select 1 from public.blueprint_estimates b where b.id=blueprint_id and (b.created_by=auth.uid() or public.is_org_admin(b.organization_id))));

grant select,insert on public.scanner_learning_samples to authenticated;
grant select,insert,update on public.blueprint_estimates to authenticated;
grant select,insert,update on public.blueprint_pages to authenticated;
