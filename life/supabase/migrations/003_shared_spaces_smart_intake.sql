-- JustGlance v2.1.0 — Shared Spaces + Smart Intake
-- ADDITIVE / MIGRATION-SAFE. Run after 001_initial_schema.sql and 002_organizer_expansion.sql.
-- Existing rows remain valid; existing shared members keep full category access by default.

create or replace function public.default_space_permissions()
returns jsonb language sql immutable as $$
  select '{
    "view_shopping": true, "edit_shopping": true,
    "view_tasks": true, "edit_tasks": true,
    "view_calendar": true, "edit_calendar": true,
    "view_notes": true, "edit_notes": true,
    "view_projects": true, "edit_projects": true,
    "invite_members": false
  }'::jsonb
$$;

alter table public.space_members
  add column if not exists permissions jsonb not null default public.default_space_permissions();

alter table public.invites
  add column if not exists permissions jsonb not null default public.default_space_permissions();

update public.space_members
set permissions = public.default_space_permissions() || coalesce(permissions, '{}'::jsonb)
where permissions is null or permissions = '{}'::jsonb;

update public.invites
set permissions = public.default_space_permissions() || coalesce(permissions, '{}'::jsonb)
where permissions is null or permissions = '{}'::jsonb;

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  icon text not null default 'basket',
  sort_order numeric(12,3) not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shopping_items
  add column if not exists list_id uuid references public.shopping_lists(id) on delete set null;

create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  kind text not null check (kind in ('thought','text','link','file','image','calendar_import')),
  title text not null check (char_length(title) between 1 and 500),
  raw_text text,
  source_url text,
  mime_type text,
  file_name text,
  storage_path text,
  parsed_kind text,
  parsed_data jsonb not null default '{}'::jsonb,
  status text not null default 'inbox' check (status in ('inbox','processed','archived')),
  created_item_id uuid references public.items(id) on delete set null,
  created_event_id uuid references public.events(id) on delete set null,
  created_note_id uuid references public.notes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'ics',
  source_name text,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists shopping_lists_space_idx on public.shopping_lists(space_id, archived_at, sort_order, created_at);
create index if not exists shopping_items_list_idx on public.shopping_items(list_id) where list_id is not null;
create index if not exists captures_user_status_idx on public.captures(user_id,status,created_at desc);
create index if not exists captures_space_status_idx on public.captures(space_id,status,created_at desc) where space_id is not null;
create index if not exists calendar_imports_user_idx on public.calendar_imports(user_id,created_at desc);
create unique index if not exists events_external_provider_unique
  on public.events(user_id,provider,external_id)
  where external_id is not null and deleted_at is null;

create or replace function public.space_permission(p_space uuid, p_permission text)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare member_role public.space_role; member_permissions jsonb; fallback boolean;
begin
  if auth.uid() is null or p_space is null then return false; end if;
  select role, permissions into member_role, member_permissions
  from public.space_members
  where space_id=p_space and user_id=auth.uid();
  if not found then return false; end if;
  if member_role in ('owner','admin') then return true; end if;
  fallback := case when p_permission='invite_members' then false else true end;
  return coalesce((member_permissions->>p_permission)::boolean, fallback);
end $$;
revoke all on function public.space_permission(uuid,text) from public;
grant execute on function public.space_permission(uuid,text) to authenticated;

create or replace function public.get_accessible_space_members_v2()
returns table(space_id uuid, user_id uuid, role public.space_role, permissions jsonb, display_name text, greeting_name text, avatar_url text)
language sql stable security definer set search_path=public as $$
  select m.space_id, m.user_id, m.role, m.permissions, p.display_name, p.greeting_name, p.avatar_url
  from public.space_members m
  join public.profiles p on p.id=m.user_id
  where public.is_space_member(m.space_id)
$$;
revoke all on function public.get_accessible_space_members_v2() from public;
grant execute on function public.get_accessible_space_members_v2() to authenticated;

create or replace function public.get_space_members_v2(p_space uuid)
returns table(user_id uuid, display_name text, greeting_name text, avatar_url text, role public.space_role, permissions jsonb)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_space_member(p_space) then raise exception 'Not allowed'; end if;
  return query
    select m.user_id,p.display_name,p.greeting_name,p.avatar_url,m.role,m.permissions
    from public.space_members m
    join public.profiles p on p.id=m.user_id
    where m.space_id=p_space
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,p.display_name;
end $$;
revoke all on function public.get_space_members_v2(uuid) from public;
grant execute on function public.get_space_members_v2(uuid) to authenticated;

create or replace function public.create_space_invite_v2(
  p_space uuid,
  p_email text default null,
  p_role text default 'member',
  p_permissions jsonb default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare raw_token text; hashed text; expiry timestamptz; role_value public.space_role; perms jsonb; permission_key text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.can_manage_space(p_space) and not public.space_permission(p_space,'invite_members') then
    raise exception 'You do not have permission to invite members to this space';
  end if;
  if exists(select 1 from public.spaces where id=p_space and is_personal) then raise exception 'Personal spaces cannot be shared'; end if;
  if p_role not in ('member','admin') then raise exception 'Invalid invite role'; end if;
  if not public.can_manage_space(p_space) and p_role <> 'member' then raise exception 'Only owners or admins can invite an admin'; end if;
  role_value := p_role::public.space_role;
  perms := public.default_space_permissions() || coalesce(p_permissions,'{}'::jsonb);
  -- Delegated inviters may never grant a permission they do not hold themselves.
  if not public.can_manage_space(p_space) then
    foreach permission_key in array array['view_shopping','edit_shopping','view_tasks','edit_tasks','view_calendar','edit_calendar','view_notes','edit_notes','view_projects','edit_projects','invite_members'] loop
      if coalesce((perms->>permission_key)::boolean,false) and not public.space_permission(p_space,permission_key) then
        raise exception 'Cannot grant permission you do not have: %', permission_key;
      end if;
    end loop;
  end if;
  raw_token := encode(gen_random_bytes(32),'hex');
  hashed := encode(digest(raw_token,'sha256'),'hex');
  expiry := now() + interval '7 days';
  insert into public.invites(space_id,created_by,invite_email,role,permissions,token_hash,expires_at)
  values(p_space,auth.uid(),lower(nullif(trim(p_email),'')),role_value,perms,hashed,expiry);
  return jsonb_build_object('token',raw_token,'space_id',p_space,'expires_at',expiry);
end $$;
revoke all on function public.create_space_invite_v2(uuid,text,text,jsonb) from public;
grant execute on function public.create_space_invite_v2(uuid,text,text,jsonb) to authenticated;

create or replace function public.consume_space_invite_v2(p_token text)
returns uuid language plpgsql security definer set search_path=public as $$
declare inv public.invites%rowtype; hashed text; current_email text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  hashed := encode(digest(trim(p_token),'sha256'),'hex');
  select * into inv from public.invites where token_hash=hashed and accepted_at is null and expires_at>now() for update;
  if not found then raise exception 'Invite is invalid or expired'; end if;
  select lower(email) into current_email from public.profiles where id=auth.uid();
  if inv.invite_email is not null and lower(inv.invite_email) <> current_email then raise exception 'Invite belongs to another email'; end if;
  if exists(select 1 from public.spaces where id=inv.space_id and is_personal) then raise exception 'Personal spaces cannot be shared'; end if;
  insert into public.space_members(space_id,user_id,role,permissions)
  values(inv.space_id,auth.uid(),inv.role,public.default_space_permissions() || coalesce(inv.permissions,'{}'::jsonb))
  on conflict(space_id,user_id) do update set role=excluded.role, permissions=excluded.permissions;
  update public.invites set accepted_by=auth.uid(),accepted_at=now() where id=inv.id;
  return inv.space_id;
end $$;
revoke all on function public.consume_space_invite_v2(text) from public;
grant execute on function public.consume_space_invite_v2(text) to authenticated;

create or replace function public.update_space_member_access(
  p_space uuid,
  p_user uuid,
  p_permissions jsonb,
  p_role text default null
)
returns void language plpgsql security definer set search_path=public as $$
declare current_role public.space_role; new_role public.space_role;
begin
  if not public.can_manage_space(p_space) then raise exception 'Not allowed'; end if;
  select role into current_role from public.space_members where space_id=p_space and user_id=p_user;
  if not found then raise exception 'Member not found'; end if;
  if current_role='owner' then raise exception 'Owner access cannot be changed here'; end if;
  new_role := current_role;
  if p_role is not null then
    if p_role not in ('member','admin') then raise exception 'Invalid role'; end if;
    if not exists(select 1 from public.space_members where space_id=p_space and user_id=auth.uid() and role='owner') and p_role='admin' then
      raise exception 'Only the owner can promote an admin';
    end if;
    new_role := p_role::public.space_role;
  end if;
  update public.space_members
  set role=new_role, permissions=public.default_space_permissions() || coalesce(p_permissions,'{}'::jsonb)
  where space_id=p_space and user_id=p_user;
end $$;
revoke all on function public.update_space_member_access(uuid,uuid,jsonb,text) from public;
grant execute on function public.update_space_member_access(uuid,uuid,jsonb,text) to authenticated;

create or replace function public.can_access_capture_object(p_name text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.captures c
    where c.storage_path=p_name
      and (c.user_id=auth.uid() or (c.space_id is not null and public.space_permission(c.space_id,'view_notes')))
  )
$$;
revoke all on function public.can_access_capture_object(text) from public;
grant execute on function public.can_access_capture_object(text) to authenticated;

alter table public.shopping_lists enable row level security;
alter table public.captures enable row level security;
alter table public.calendar_imports enable row level security;

drop policy if exists shopping_lists_select_access on public.shopping_lists;
create policy shopping_lists_select_access on public.shopping_lists for select
using(public.space_permission(space_id,'view_shopping'));
drop policy if exists shopping_lists_insert_access on public.shopping_lists;
create policy shopping_lists_insert_access on public.shopping_lists for insert
with check(created_by=auth.uid() and public.space_permission(space_id,'edit_shopping'));
drop policy if exists shopping_lists_update_access on public.shopping_lists;
create policy shopping_lists_update_access on public.shopping_lists for update
using(public.space_permission(space_id,'edit_shopping')) with check(public.space_permission(space_id,'edit_shopping'));
drop policy if exists shopping_lists_delete_access on public.shopping_lists;
create policy shopping_lists_delete_access on public.shopping_lists for delete
using(public.space_permission(space_id,'edit_shopping'));

drop policy if exists captures_select_access on public.captures;
create policy captures_select_access on public.captures for select
using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'view_notes')));
drop policy if exists captures_insert_access on public.captures;
create policy captures_insert_access on public.captures for insert
with check(user_id=auth.uid() and (space_id is null or public.space_permission(space_id,'edit_notes')));
drop policy if exists captures_update_access on public.captures;
create policy captures_update_access on public.captures for update
using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_notes')))
with check((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_notes')));
drop policy if exists captures_delete_access on public.captures;
create policy captures_delete_access on public.captures for delete
using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_notes')));

drop policy if exists calendar_imports_self on public.calendar_imports;
create policy calendar_imports_self on public.calendar_imports for all using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Tighten shared-space category visibility while preserving personal data access.
drop policy if exists items_select_access on public.items;
create policy items_select_access on public.items for select using(
  (space_id is null and user_id=auth.uid()) or
  (space_id is not null and public.space_permission(space_id, case when type='shopping' then 'view_shopping' else 'view_tasks' end))
);
drop policy if exists items_insert_access on public.items;
create policy items_insert_access on public.items for insert with check(
  user_id=auth.uid() and (space_id is null or public.space_permission(space_id, case when type='shopping' then 'edit_shopping' else 'edit_tasks' end))
  and (assigned_to is null or space_id is not null)
);
drop policy if exists items_update_access on public.items;
create policy items_update_access on public.items for update using(
  (space_id is null and user_id=auth.uid()) or
  (space_id is not null and public.space_permission(space_id, case when type='shopping' then 'edit_shopping' else 'edit_tasks' end))
) with check(
  (space_id is null and user_id=auth.uid()) or
  (space_id is not null and public.space_permission(space_id, case when type='shopping' then 'edit_shopping' else 'edit_tasks' end))
);
drop policy if exists items_delete_access on public.items;
create policy items_delete_access on public.items for delete using(
  (space_id is null and user_id=auth.uid()) or
  (space_id is not null and public.space_permission(space_id, case when type='shopping' then 'edit_shopping' else 'edit_tasks' end))
);

drop policy if exists shopping_select_access on public.shopping_items;
create policy shopping_select_access on public.shopping_items for select using(exists(
  select 1 from public.items i where i.id=item_id and ((i.space_id is null and i.user_id=auth.uid()) or (i.space_id is not null and public.space_permission(i.space_id,'view_shopping')))
));
drop policy if exists shopping_write_access on public.shopping_items;
create policy shopping_write_access on public.shopping_items for all using(exists(
  select 1 from public.items i where i.id=item_id and ((i.space_id is null and i.user_id=auth.uid()) or (i.space_id is not null and public.space_permission(i.space_id,'edit_shopping')))
)) with check(exists(
  select 1 from public.items i where i.id=item_id and ((i.space_id is null and i.user_id=auth.uid()) or (i.space_id is not null and public.space_permission(i.space_id,'edit_shopping')))
));

drop policy if exists events_select_access on public.events;
create policy events_select_access on public.events for select using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'view_calendar')));
drop policy if exists events_insert_access on public.events;
create policy events_insert_access on public.events for insert with check(user_id=auth.uid() and (space_id is null or public.space_permission(space_id,'edit_calendar')));
drop policy if exists events_update_access on public.events;
create policy events_update_access on public.events for update using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_calendar'))) with check((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_calendar')));
drop policy if exists events_delete_access on public.events;
create policy events_delete_access on public.events for delete using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_calendar')));

drop policy if exists notes_select_access on public.notes;
create policy notes_select_access on public.notes for select using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'view_notes')));
drop policy if exists notes_insert_access on public.notes;
create policy notes_insert_access on public.notes for insert with check(user_id=auth.uid() and (space_id is null or public.space_permission(space_id,'edit_notes')));
drop policy if exists notes_update_access on public.notes;
create policy notes_update_access on public.notes for update using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_notes'))) with check((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_notes')));
drop policy if exists notes_delete_access on public.notes;
create policy notes_delete_access on public.notes for delete using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_notes')));

drop policy if exists projects_select_access on public.projects;
create policy projects_select_access on public.projects for select using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'view_projects')));
drop policy if exists projects_insert_access on public.projects;
create policy projects_insert_access on public.projects for insert with check(user_id=auth.uid() and (space_id is null or public.space_permission(space_id,'edit_projects')));
drop policy if exists projects_update_access on public.projects;
create policy projects_update_access on public.projects for update using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_projects'))) with check((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_projects')));
drop policy if exists projects_delete_access on public.projects;
create policy projects_delete_access on public.projects for delete using((space_id is null and user_id=auth.uid()) or (space_id is not null and public.space_permission(space_id,'edit_projects')));

-- Storage for files/images captured by the user. Private by default.
insert into storage.buckets(id,name,public,file_size_limit)
values('justglance-captures','justglance-captures',false,15728640)
on conflict(id) do update set public=false, file_size_limit=15728640;

drop policy if exists justglance_captures_insert on storage.objects;
create policy justglance_captures_insert on storage.objects for insert to authenticated
with check(bucket_id='justglance-captures' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists justglance_captures_select on storage.objects;
create policy justglance_captures_select on storage.objects for select to authenticated
using(bucket_id='justglance-captures' and ((storage.foldername(name))[1]=auth.uid()::text or public.can_access_capture_object(name)));
drop policy if exists justglance_captures_update on storage.objects;
create policy justglance_captures_update on storage.objects for update to authenticated
using(bucket_id='justglance-captures' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='justglance-captures' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists justglance_captures_delete on storage.objects;
create policy justglance_captures_delete on storage.objects for delete to authenticated
using(bucket_id='justglance-captures' and (storage.foldername(name))[1]=auth.uid()::text);

drop trigger if exists shopping_lists_updated_at on public.shopping_lists;
create trigger shopping_lists_updated_at before update on public.shopping_lists for each row execute function public.set_updated_at();
drop trigger if exists captures_updated_at on public.captures;
create trigger captures_updated_at before update on public.captures for each row execute function public.set_updated_at();
drop trigger if exists captures_creator_guard on public.captures;
create trigger captures_creator_guard before update on public.captures for each row execute function public.protect_creator_identity();

do $$ begin alter publication supabase_realtime add table public.shopping_lists; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.captures; exception when duplicate_object then null; end $$;
