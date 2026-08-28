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
