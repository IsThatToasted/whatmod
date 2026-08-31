-- Aurelium Field v0.9.3 - shared Field operations
-- Idempotent. Adds project-scoped field records and private field file storage.

create table if not exists public.field_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  record_type text not null check (record_type in ('photo_progress','daily_log','punch','document','safety')),
  title text not null default '',
  notes text,
  status text not null default 'open',
  occurred_at timestamptz not null default now(),
  due_at timestamptz,
  assignee_name text,
  weather text,
  manpower integer check (manpower is null or manpower >= 0),
  work_completed text,
  blockers text,
  revision text,
  safety_type text,
  severity text,
  acknowledged boolean not null default false,
  attachment_path text,
  attachment_name text,
  attachment_content_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists field_records_project_idx on public.field_records(project_id, occurred_at desc);
create index if not exists field_records_org_type_idx on public.field_records(organization_id, record_type, occurred_at desc);

alter table public.field_records enable row level security;

drop policy if exists field_records_member_select on public.field_records;
create policy field_records_member_select on public.field_records for select to authenticated
  using(public.is_org_member(organization_id));

drop policy if exists field_records_member_insert on public.field_records;
create policy field_records_member_insert on public.field_records for insert to authenticated
  with check(
  created_by=auth.uid()
  and public.is_org_member(organization_id)
  and exists(select 1 from public.projects p where p.id=project_id and p.organization_id=organization_id)
);

drop policy if exists field_records_creator_or_admin_update on public.field_records;
create policy field_records_creator_or_admin_update on public.field_records for update to authenticated
  using(created_by=auth.uid() or public.is_org_admin(organization_id))
  with check(
  (created_by=auth.uid() or public.is_org_admin(organization_id))
  and public.is_org_member(organization_id)
  and exists(select 1 from public.projects p where p.id=project_id and p.organization_id=organization_id)
);

drop policy if exists field_records_creator_or_admin_delete on public.field_records;
create policy field_records_creator_or_admin_delete on public.field_records for delete to authenticated
  using(created_by=auth.uid() or public.is_org_admin(organization_id));

grant select, insert, update, delete on public.field_records to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'field-files',
  'field-files',
  false,
  52428800,
  array['image/jpeg','image/png','image/heic','application/pdf','application/octet-stream']
)
on conflict(id) do update set
  public=false,
  file_size_limit=52428800,
  allowed_mime_types=array['image/jpeg','image/png','image/heic','application/pdf','application/octet-stream'];

-- Object paths are <organization_id>/<project_id>/<user_id>/<filename>.
drop policy if exists field_files_member_select on storage.objects;
create policy field_files_member_select on storage.objects for select to authenticated
using(bucket_id='field-files' and public.is_org_member((storage.foldername(name))[1]::uuid));

drop policy if exists field_files_member_insert on storage.objects;
create policy field_files_member_insert on storage.objects for insert to authenticated
with check(
  bucket_id='field-files'
  and public.is_org_member((storage.foldername(name))[1]::uuid)
  and (storage.foldername(name))[3]::uuid = auth.uid()
);

drop policy if exists field_files_creator_or_admin_delete on storage.objects;
create policy field_files_creator_or_admin_delete on storage.objects for delete to authenticated
using(bucket_id='field-files' and public.is_org_member((storage.foldername(name))[1]::uuid));
