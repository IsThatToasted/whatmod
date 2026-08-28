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
