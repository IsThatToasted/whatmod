-- Authentication onboarding, organization invites, GPS time clock approvals,
-- and persisted RoomPlan estimate data. Apply after 001 and 002.

-- ---------- Organization bootstrap + invites ----------
create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  email text,
  role public.member_role not null default 'crew',
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists organization_invites_org_idx on public.organization_invites(organization_id, created_at desc);
create index if not exists organization_invites_token_idx on public.organization_invites(token);
alter table public.organization_invites enable row level security;

create or replace function public.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  new_id uuid;
  base_slug text;
  candidate_slug text;
  n integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(org_name)) < 2 then raise exception 'Organization name is required'; end if;

  base_slug := regexp_replace(lower(trim(org_name)), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'organization'; end if;
  candidate_slug := base_slug;
  while exists(select 1 from public.organizations where slug=candidate_slug) loop
    n := n + 1;
    candidate_slug := base_slug || '-' || n::text;
  end loop;

  insert into public.organizations(name, slug, created_by)
  values(trim(org_name), candidate_slug, auth.uid())
  returning id into new_id;

  insert into public.organization_members(organization_id,user_id,role,display_name)
  values(new_id, auth.uid(), 'owner', coalesce(auth.jwt()->'user_metadata'->>'full_name', auth.jwt()->>'email'));

  return new_id;
end;
$$;
grant execute on function public.create_organization(text) to authenticated;

create or replace function public.create_organization_invite(invite_email text default null, invite_role public.member_role default 'crew')
returns table(token uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path=public
as $$
declare
  org_id uuid;
begin
  select m.organization_id into org_id
  from public.organization_members m
  where m.user_id=auth.uid() and m.active=true and m.role in ('owner','admin')
  order by m.created_at asc limit 1;
  if org_id is null then raise exception 'Organization admin required'; end if;

  return query
  insert into public.organization_invites(organization_id,email,role,invited_by)
  values(org_id, nullif(lower(trim(invite_email)),''), invite_role, auth.uid())
  returning organization_invites.token, organization_invites.expires_at;
end;
$$;
grant execute on function public.create_organization_invite(text, public.member_role) to authenticated;

create or replace function public.accept_organization_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  inv public.organization_invites%rowtype;
  caller_email text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into inv from public.organization_invites
   where token=invite_token and accepted_at is null and revoked_at is null and expires_at > now()
   for update;
  if inv.id is null then raise exception 'Invite is invalid or expired'; end if;

  caller_email := lower(coalesce(auth.jwt()->>'email',''));
  if inv.email is not null and inv.email <> caller_email then
    raise exception 'This invite was issued to another email address';
  end if;

  insert into public.organization_members(organization_id,user_id,role,display_name)
  values(inv.organization_id, auth.uid(), inv.role, coalesce(auth.jwt()->'user_metadata'->>'full_name', auth.jwt()->>'email'))
  on conflict(organization_id,user_id) do update set active=true, role=excluded.role;

  update public.organization_invites set accepted_by=auth.uid(), accepted_at=now() where id=inv.id;
  return inv.organization_id;
end;
$$;
grant execute on function public.accept_organization_invite(uuid) to authenticated;

drop policy if exists org_invites_admin_select on public.organization_invites;
create policy org_invites_admin_select on public.organization_invites for select
  using(public.is_org_admin(organization_id));
drop policy if exists org_invites_admin_update on public.organization_invites;
create policy org_invites_admin_update on public.organization_invites for update
  using(public.is_org_admin(organization_id));

-- ---------- Time clock ----------
alter table public.time_entries add column if not exists status text not null default 'draft'
  check(status in ('draft','submitted','approved','rejected'));
alter table public.time_entries add column if not exists submitted_at timestamptz;
alter table public.time_entries add column if not exists approved_at timestamptz;
alter table public.time_entries add column if not exists rejected_at timestamptz;
alter table public.time_entries add column if not exists rejection_reason text;
alter table public.time_entries add column if not exists clock_in_latitude double precision;
alter table public.time_entries add column if not exists clock_in_longitude double precision;
alter table public.time_entries add column if not exists clock_in_accuracy_m double precision;
alter table public.time_entries add column if not exists clock_out_latitude double precision;
alter table public.time_entries add column if not exists clock_out_longitude double precision;
alter table public.time_entries add column if not exists clock_out_accuracy_m double precision;
alter table public.time_entries add column if not exists updated_at timestamptz not null default now();

create table if not exists public.time_location_samples (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m double precision,
  captured_at timestamptz not null default now()
);
create index if not exists time_location_samples_entry_idx on public.time_location_samples(time_entry_id,captured_at);
alter table public.time_location_samples enable row level security;
drop policy if exists time_location_self_insert on public.time_location_samples;
create policy time_location_self_insert on public.time_location_samples for insert
  with check(user_id=auth.uid() and public.is_org_member(organization_id));
drop policy if exists time_location_member_select on public.time_location_samples;
create policy time_location_member_select on public.time_location_samples for select
  using(user_id=auth.uid() or public.is_org_admin(organization_id));

create table if not exists public.time_entry_edit_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  proposed_clock_in timestamptz not null,
  proposed_clock_out timestamptz,
  proposed_project_id uuid not null references public.projects(id) on delete cascade,
  proposed_cost_code text,
  proposed_notes text,
  reason text not null,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  check(proposed_clock_out is null or proposed_clock_out >= proposed_clock_in)
);
alter table public.time_entry_edit_requests enable row level security;
drop policy if exists time_edit_self_select on public.time_entry_edit_requests;
create policy time_edit_self_select on public.time_entry_edit_requests for select
  using(requested_by=auth.uid() or public.is_org_admin(organization_id));
drop policy if exists time_edit_self_insert on public.time_entry_edit_requests;
create policy time_edit_self_insert on public.time_entry_edit_requests for insert
  with check(requested_by=auth.uid() and public.is_org_member(organization_id));
drop policy if exists time_edit_admin_update on public.time_entry_edit_requests;
create policy time_edit_admin_update on public.time_entry_edit_requests for update
  using(public.is_org_admin(organization_id));

create or replace function public.submit_time_entry(entry_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.time_entries set status='submitted', submitted_at=now(), updated_at=now()
  where id=entry_id and user_id=auth.uid() and status in ('draft','rejected') and clock_out is not null;
  if not found then raise exception 'Time entry must be yours, clocked out, and editable'; end if;
end; $$;
grant execute on function public.submit_time_entry(uuid) to authenticated;

create or replace function public.request_time_entry_edit(
  entry_id uuid, new_clock_in timestamptz, new_clock_out timestamptz,
  new_project_id uuid, new_cost_code text, new_notes text, edit_reason text
) returns uuid language plpgsql security definer set search_path=public as $$
declare e public.time_entries%rowtype; request_id uuid;
begin
  select * into e from public.time_entries where id=entry_id and user_id=auth.uid();
  if e.id is null then raise exception 'Time entry not found'; end if;
  if e.status='draft' then raise exception 'Draft entries can be edited directly'; end if;
  insert into public.time_entry_edit_requests(
    organization_id,time_entry_id,requested_by,proposed_clock_in,proposed_clock_out,
    proposed_project_id,proposed_cost_code,proposed_notes,reason
  ) values(e.organization_id,e.id,auth.uid(),new_clock_in,new_clock_out,new_project_id,new_cost_code,new_notes,trim(edit_reason))
  returning id into request_id;
  return request_id;
end; $$;
grant execute on function public.request_time_entry_edit(uuid,timestamptz,timestamptz,uuid,text,text,text) to authenticated;

create or replace function public.decide_time_entry_edit(request_id uuid, approve boolean, admin_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare r public.time_entry_edit_requests%rowtype;
begin
  select * into r from public.time_entry_edit_requests where id=request_id and status='pending' for update;
  if r.id is null then raise exception 'Request not found'; end if;
  if not public.is_org_admin(r.organization_id) then raise exception 'Admin required'; end if;
  if approve then
    update public.time_entries set clock_in=r.proposed_clock_in, clock_out=r.proposed_clock_out,
      project_id=r.proposed_project_id, cost_code=r.proposed_cost_code, notes=r.proposed_notes,
      updated_at=now() where id=r.time_entry_id;
  end if;
  update public.time_entry_edit_requests set status=case when approve then 'approved' else 'rejected' end,
    decided_by=auth.uid(), decided_at=now(), decision_note=admin_note where id=r.id;
end; $$;
grant execute on function public.decide_time_entry_edit(uuid,boolean,text) to authenticated;

-- Prevent employees from silently altering submitted/approved rows. Admins may approve/reject.
create or replace function public.guard_time_entry_mutation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.status <> 'draft' and not public.is_org_admin(old.organization_id) then
    if new.clock_in is distinct from old.clock_in or new.clock_out is distinct from old.clock_out
      or new.project_id is distinct from old.project_id or new.cost_code is distinct from old.cost_code
      or new.notes is distinct from old.notes then
      raise exception 'Submitted time requires an approved edit request';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists guard_time_entry_mutation on public.time_entries;
create trigger guard_time_entry_mutation before update on public.time_entries
for each row execute function public.guard_time_entry_mutation();

-- ---------- Walkthrough model + estimate enrichment ----------
alter table public.walkthrough_scans add column if not exists usdz_storage_path text;
alter table public.walkthrough_scans add column if not exists roomplan_storage_path text;
alter table public.walkthrough_scans add column if not exists wall_gross_sqft numeric(14,3);
alter table public.walkthrough_scans add column if not exists openings_sqft numeric(14,3);
alter table public.walkthrough_scans add column if not exists paintable_wall_sqft numeric(14,3);
alter table public.walkthrough_scans add column if not exists average_wall_height_ft numeric(10,3);
alter table public.walkthrough_scans add column if not exists wall_linear_ft numeric(14,3);
alter table public.walkthrough_scans add column if not exists measurements_confirmed boolean not null default false;
alter table public.walkthrough_scans add column if not exists production_units_per_hour numeric(12,3);

-- Storage buckets are public=false. Client access is governed by storage.objects RLS.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('walkthrough-media','walkthrough-media',false,104857600,array['video/mp4','image/jpeg','model/vnd.usdz+zip','application/octet-stream','application/json'])
on conflict(id) do nothing;

-- Object paths are: <organization_id>/<project_id>/<user_id>/<filename>
drop policy if exists walkthrough_storage_member_select on storage.objects;
create policy walkthrough_storage_member_select on storage.objects for select to authenticated
using(bucket_id='walkthrough-media' and public.is_org_member((storage.foldername(name))[1]::uuid));
drop policy if exists walkthrough_storage_member_insert on storage.objects;
create policy walkthrough_storage_member_insert on storage.objects for insert to authenticated
with check(bucket_id='walkthrough-media' and public.is_org_member((storage.foldername(name))[1]::uuid));
drop policy if exists walkthrough_storage_owner_delete on storage.objects;
create policy walkthrough_storage_owner_delete on storage.objects for delete to authenticated
using(bucket_id='walkthrough-media' and public.is_org_member((storage.foldername(name))[1]::uuid));


-- Explicit Data API privileges for newly introduced tables. RLS still determines which rows are visible/mutable.
grant select, insert, update on public.organization_invites to authenticated;
grant select, insert on public.time_location_samples to authenticated;
grant select, insert, update on public.time_entry_edit_requests to authenticated;
grant select, insert, update, delete on public.walkthrough_scans to authenticated;
-- v0.4.1 SAFE ADMIN WORKSPACE INSTALL
-- Safe on databases where migration 003 was already applied.
-- This does not delete application data. It only normalizes existing RLS policies
-- before applying the v0.4 admin workspace changes.

-- Normalize invite policies originally introduced by migration 003.
drop policy if exists org_invites_admin_select on public.organization_invites;
create policy org_invites_admin_select on public.organization_invites for select
  using(public.is_org_admin(organization_id));

drop policy if exists org_invites_admin_update on public.organization_invites;
create policy org_invites_admin_update on public.organization_invites for update
  using(public.is_org_admin(organization_id));

-- Admin workspace: protected employee management, timecard review/editing,
-- invite administration, and employee timecard privacy. Apply after 003.

-- Keep admin adjustments auditable.
alter table public.time_entries add column if not exists admin_adjusted_by uuid references auth.users(id) on delete set null;
alter table public.time_entries add column if not exists admin_adjusted_at timestamptz;
alter table public.time_entries add column if not exists admin_adjustment_note text;
alter table public.time_entries add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.time_entries add column if not exists reviewed_at timestamptz;

-- Membership changes go through audited/security-definer admin RPCs only.
-- This prevents an admin client from bypassing owner protections with a direct REST update.
drop policy if exists member_admin_all on public.organization_members;
drop policy if exists member_select on public.organization_members;
drop policy if exists member_self_or_admin_select on public.organization_members;
create policy member_self_or_admin_select on public.organization_members for select
  using(user_id=auth.uid() or public.is_org_admin(organization_id));

-- Employees may only read their own timecards. Organization owner/admin may read all.
drop policy if exists time_member_select on public.time_entries;
drop policy if exists time_self_or_admin_select on public.time_entries;
create policy time_self_or_admin_select on public.time_entries for select
  using(user_id = auth.uid() or public.is_org_admin(organization_id));

-- Direct employee updates are limited to their own draft. Submission/review transitions use RPCs.
drop policy if exists time_self_update on public.time_entries;
drop policy if exists time_self_draft_or_admin_update on public.time_entries;
create policy time_self_draft_or_admin_update on public.time_entries for update
  using((user_id=auth.uid() and status='draft') or public.is_org_admin(organization_id))
  with check((user_id=auth.uid() and status='draft') or public.is_org_admin(organization_id));

-- Harden invite creation: admins may invite normal roles; only an owner may invite another owner.
create or replace function public.create_organization_invite(invite_email text default null, invite_role public.member_role default 'crew')
returns table(token uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path=public
as $$
declare
  org_id uuid;
  caller_role public.member_role;
begin
  select m.organization_id,m.role into org_id,caller_role
  from public.organization_members m
  where m.user_id=auth.uid() and m.active=true and m.role in ('owner','admin')
  order by m.created_at asc limit 1;
  if org_id is null then raise exception 'Organization admin required'; end if;
  if invite_role='owner' and caller_role <> 'owner' then raise exception 'Only an owner can invite another owner'; end if;

  return query
  insert into public.organization_invites(organization_id,email,role,invited_by)
  values(org_id, nullif(lower(trim(invite_email)),''), invite_role, auth.uid())
  returning organization_invites.token, organization_invites.expires_at;
end;
$$;
grant execute on function public.create_organization_invite(text, public.member_role) to authenticated;

-- Return the admin directory including auth email without exposing auth.users directly.
create or replace function public.admin_list_members()
returns table(
  user_id uuid,
  display_name text,
  email text,
  phone text,
  role public.member_role,
  active boolean,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  org_id uuid;
begin
  select m.organization_id into org_id
  from public.organization_members m
  where m.user_id=auth.uid() and m.active=true and m.role in ('owner','admin')
  order by m.created_at asc limit 1;
  if org_id is null then raise exception 'Organization admin required'; end if;

  return query
  select m.user_id, m.display_name, u.email::text, m.phone, m.role, m.active, m.created_at
  from public.organization_members m
  left join auth.users u on u.id=m.user_id
  where m.organization_id=org_id
  order by m.active desc,
    case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,
    coalesce(m.display_name,u.email,'') asc;
end;
$$;
grant execute on function public.admin_list_members() to authenticated;

create or replace function public.admin_update_member(
  member_user_id uuid,
  new_display_name text,
  new_phone text,
  new_role public.member_role,
  new_active boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  org_id uuid;
  caller_role public.member_role;
  target_role public.member_role;
  owner_count integer;
begin
  select m.organization_id,m.role into org_id,caller_role
  from public.organization_members m
  where m.user_id=auth.uid() and m.active=true and m.role in ('owner','admin')
  order by m.created_at asc limit 1;
  if org_id is null then raise exception 'Organization admin required'; end if;

  select m.role into target_role from public.organization_members m
  where m.organization_id=org_id and m.user_id=member_user_id;
  if target_role is null then raise exception 'Employee not found'; end if;

  -- Only an owner can change another owner's membership.
  if target_role='owner' and caller_role <> 'owner' then
    raise exception 'Only an owner can manage an owner account';
  end if;
  if new_role='owner' and caller_role <> 'owner' then
    raise exception 'Only an owner can promote another owner';
  end if;

  -- Never allow the organization to lose its final active owner.
  if target_role='owner' and (new_role <> 'owner' or new_active=false) then
    select count(*) into owner_count from public.organization_members
    where organization_id=org_id and role='owner' and active=true;
    if owner_count <= 1 then raise exception 'The organization must keep at least one active owner'; end if;
  end if;

  update public.organization_members
  set display_name=nullif(trim(new_display_name),''),
      phone=nullif(trim(new_phone),''),
      role=new_role,
      active=new_active
  where organization_id=org_id and user_id=member_user_id;
end;
$$;
grant execute on function public.admin_update_member(uuid,text,text,public.member_role,boolean) to authenticated;

-- "Remove" deactivates membership so timecards and audit history remain intact.
create or replace function public.admin_remove_member(member_user_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  org_id uuid;
  caller_role public.member_role;
  target_role public.member_role;
  owner_count integer;
begin
  select m.organization_id,m.role into org_id,caller_role
  from public.organization_members m
  where m.user_id=auth.uid() and m.active=true and m.role in ('owner','admin')
  order by m.created_at asc limit 1;
  if org_id is null then raise exception 'Organization admin required'; end if;
  if member_user_id=auth.uid() then raise exception 'You cannot remove your own membership here'; end if;

  select m.role into target_role from public.organization_members m
  where m.organization_id=org_id and m.user_id=member_user_id;
  if target_role is null then raise exception 'Employee not found'; end if;
  if target_role='owner' and caller_role <> 'owner' then raise exception 'Only an owner can remove an owner'; end if;
  if target_role='owner' then
    select count(*) into owner_count from public.organization_members
    where organization_id=org_id and role='owner' and active=true;
    if owner_count <= 1 then raise exception 'The organization must keep at least one active owner'; end if;
  end if;

  update public.organization_members set active=false
  where organization_id=org_id and user_id=member_user_id;
end;
$$;
grant execute on function public.admin_remove_member(uuid) to authenticated;

create or replace function public.revoke_organization_invite(invite_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare org_id uuid;
begin
  select organization_id into org_id from public.organization_invites where id=invite_id;
  if org_id is null then raise exception 'Invite not found'; end if;
  if not public.is_org_admin(org_id) then raise exception 'Organization admin required'; end if;
  update public.organization_invites set revoked_at=now()
  where id=invite_id and accepted_at is null and revoked_at is null;
end;
$$;
grant execute on function public.revoke_organization_invite(uuid) to authenticated;

-- Admin edits are direct but always leave an adjustment trail.
create or replace function public.admin_update_time_entry(
  entry_id uuid,
  new_clock_in timestamptz,
  new_clock_out timestamptz,
  new_project_id uuid,
  new_cost_code text,
  new_notes text,
  adjustment_reason text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare e public.time_entries%rowtype;
begin
  select * into e from public.time_entries where id=entry_id for update;
  if e.id is null then raise exception 'Timecard not found'; end if;
  if not public.is_org_admin(e.organization_id) then raise exception 'Organization admin required'; end if;
  if new_clock_out is not null and new_clock_out < new_clock_in then raise exception 'Clock out cannot be before clock in'; end if;
  if length(trim(coalesce(adjustment_reason,''))) < 2 then raise exception 'Adjustment reason is required'; end if;
  if not exists(select 1 from public.projects p where p.id=new_project_id and p.organization_id=e.organization_id) then
    raise exception 'Project is not in this organization';
  end if;

  update public.time_entries
  set clock_in=new_clock_in,
      clock_out=new_clock_out,
      project_id=new_project_id,
      cost_code=nullif(trim(new_cost_code),''),
      notes=nullif(trim(new_notes),''),
      admin_adjusted_by=auth.uid(),
      admin_adjusted_at=now(),
      admin_adjustment_note=trim(adjustment_reason),
      updated_at=now()
  where id=e.id;
end;
$$;
grant execute on function public.admin_update_time_entry(uuid,timestamptz,timestamptz,uuid,text,text,text) to authenticated;

create or replace function public.admin_decide_time_entry(entry_id uuid, approve boolean, decision_note text default null)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare e public.time_entries%rowtype;
begin
  select * into e from public.time_entries where id=entry_id for update;
  if e.id is null then raise exception 'Timecard not found'; end if;
  if not public.is_org_admin(e.organization_id) then raise exception 'Organization admin required'; end if;
  if e.clock_out is null then raise exception 'An open shift cannot be reviewed'; end if;

  update public.time_entries
  set status=case when approve then 'approved' else 'rejected' end,
      approved_by=case when approve then auth.uid() else null end,
      approved_at=case when approve then now() else null end,
      rejected_at=case when approve then null else now() end,
      rejection_reason=case when approve then null else nullif(trim(decision_note),'') end,
      reviewed_by=auth.uid(),
      reviewed_at=now(),
      updated_at=now()
  where id=e.id;
end;
$$;
grant execute on function public.admin_decide_time_entry(uuid,boolean,text) to authenticated;
-- v0.5.0: project walkthrough completion + administrator timecard deletion.
-- Safe to run repeatedly after 004_admin_workspace_safe.sql.

alter table public.walkthrough_scans add column if not exists room_name text;
alter table public.walkthrough_scans add column if not exists archived_at timestamptz;
alter table public.projects add column if not exists walkthrough_completed_at timestamptz;

update public.walkthrough_scans ws
set room_name = er.name
from public.estimate_rooms er
where ws.room_name is null and ws.room_id = er.id;

create or replace function public.complete_project_walkthrough(target_project_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path=public
as $$
declare
  project_org uuid;
  completed_at timestamptz := now();
begin
  select organization_id into project_org from public.projects where id=target_project_id;
  if project_org is null then raise exception 'Project not found'; end if;
  if not public.is_org_member(project_org) then raise exception 'Organization membership required'; end if;
  if not exists(select 1 from public.walkthrough_scans where project_id=target_project_id) then
    raise exception 'This project has no walkthrough rooms to complete';
  end if;

  update public.walkthrough_scans
  set archived_at=coalesce(archived_at,completed_at)
  where project_id=target_project_id;

  update public.projects
  set walkthrough_completed_at=completed_at, updated_at=completed_at
  where id=target_project_id;

  return completed_at;
end;
$$;
grant execute on function public.complete_project_walkthrough(uuid) to authenticated;

-- Deliberate hard-delete. Existing FK cascades remove GPS samples and edit requests.
create or replace function public.admin_delete_time_entry(entry_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare e public.time_entries%rowtype;
begin
  select * into e from public.time_entries where id=entry_id;
  if e.id is null then raise exception 'Timecard not found'; end if;
  if not public.is_org_admin(e.organization_id) then raise exception 'Organization admin required'; end if;
  delete from public.time_entries where id=e.id;
end;
$$;
grant execute on function public.admin_delete_time_entry(uuid) to authenticated;
-- v0.7.0 rebuilt project-detail durability.
-- Safe to run repeatedly after 005_project_walkthrough_completion.sql.
alter table public.projects add column if not exists client_name text;
alter table public.projects add column if not exists progress_percent integer not null default 0
  check(progress_percent between 0 and 100);
