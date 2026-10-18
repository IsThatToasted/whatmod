-- v0.14.0: resilient admin permissions + capability enforcement.
create table if not exists public.organization_member_permissions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null,
  allowed boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (organization_id,user_id,permission_key)
);
alter table public.organization_member_permissions enable row level security;

drop policy if exists member_permissions_self_select on public.organization_member_permissions;
create policy member_permissions_self_select on public.organization_member_permissions for select using (
  user_id=auth.uid() or public.is_org_admin(organization_id)
);
drop policy if exists member_permissions_admin_write on public.organization_member_permissions;
create policy member_permissions_admin_write on public.organization_member_permissions for all using (
  public.is_org_admin(organization_id)
) with check (public.is_org_admin(organization_id));
grant select,insert,update,delete on public.organization_member_permissions to authenticated;

create or replace function public.member_has_permission(permission_key text, target_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select case
    when exists(select 1 from public.organization_members m where m.user_id=target_user and m.active=true and m.role in ('owner','admin')) then true
    else coalesce((
      select p.allowed from public.organization_member_permissions p
      join public.organization_members m on m.organization_id=p.organization_id and m.user_id=p.user_id
      where p.user_id=target_user and p.permission_key=$1 and m.active=true
      order by p.updated_at desc limit 1
    ), true)
  end;
$$;
grant execute on function public.member_has_permission(text,uuid) to authenticated;

create or replace function public.my_permissions()
returns table(permission_key text,allowed boolean)
language plpgsql security definer set search_path=public as $$
declare oid uuid; r public.member_role;
begin
  select organization_id,role into oid,r from public.organization_members where user_id=auth.uid() and active=true order by created_at limit 1;
  if oid is null then return; end if;
  return query
  with keys(k) as (values
    ('chat.send'),('chat.create'),('time.edit_own'),('time.submit'),
    ('field.photos'),('field.daily_logs'),('field.punch'),
    ('estimate.smart_scan'),('estimate.blueprint')
  )
  select keys.k, case when r in ('owner','admin') then true else coalesce(p.allowed,true) end
  from keys left join public.organization_member_permissions p on p.organization_id=oid and p.user_id=auth.uid() and p.permission_key=keys.k;
end;$$;
grant execute on function public.my_permissions() to authenticated;

create or replace function public.admin_get_member_permissions(member_user_id uuid)
returns table(permission_key text,allowed boolean)
language plpgsql security definer set search_path=public as $$
declare oid uuid;
begin
  select organization_id into oid from public.organization_members where user_id=auth.uid() and active=true and role in ('owner','admin') order by created_at limit 1;
  if oid is null or not exists(select 1 from public.organization_members where organization_id=oid and user_id=member_user_id) then raise exception 'Organization admin required'; end if;
  return query
  with keys(k) as (values
    ('chat.send'),('chat.create'),('time.edit_own'),('time.submit'),
    ('field.photos'),('field.daily_logs'),('field.punch'),
    ('estimate.smart_scan'),('estimate.blueprint')
  )
  select keys.k, coalesce(p.allowed,true) from keys left join public.organization_member_permissions p on p.organization_id=oid and p.user_id=member_user_id and p.permission_key=keys.k;
end;$$;
grant execute on function public.admin_get_member_permissions(uuid) to authenticated;

create or replace function public.admin_set_member_permission(member_user_id uuid, key text, new_allowed boolean)
returns void language plpgsql security definer set search_path=public as $$
declare oid uuid; target_role public.member_role;
begin
  select organization_id into oid from public.organization_members where user_id=auth.uid() and active=true and role in ('owner','admin') order by created_at limit 1;
  if oid is null then raise exception 'Organization admin required'; end if;
  select role into target_role from public.organization_members where organization_id=oid and user_id=member_user_id;
  if target_role is null then raise exception 'Member not found'; end if;
  if target_role='owner' then return; end if;
  insert into public.organization_member_permissions(organization_id,user_id,permission_key,allowed,updated_at,updated_by)
  values(oid,member_user_id,key,new_allowed,now(),auth.uid())
  on conflict(organization_id,user_id,permission_key) do update set allowed=excluded.allowed,updated_at=now(),updated_by=auth.uid();
end;$$;
grant execute on function public.admin_set_member_permission(uuid,text,boolean) to authenticated;

-- Enforce the two highest-impact chat capabilities at the database boundary.
drop policy if exists chat_messages_member_insert on public.chat_messages;
drop policy if exists chat_messages_permission_insert on public.chat_messages;
create policy chat_messages_permission_insert on public.chat_messages for insert to authenticated with check (
  sender_id=auth.uid() and public.member_has_permission('chat.send',auth.uid()) and public.chat_can_access_conversation(conversation_id)
);

-- Wrap existing conversation creation with permission enforcement while preserving API shape.
create or replace function public.chat_assert_create_permission()
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.member_has_permission('chat.create',auth.uid()) then raise exception 'Chat creation permission required'; end if;
end;$$;
grant execute on function public.chat_assert_create_permission() to authenticated;


-- Replace channel/group/direct creation RPC with the same v0.12 behavior plus capability enforcement.
create or replace function public.chat_create_conversation(
  p_organization_id uuid, p_title text, p_kind text default 'channel', p_project_id uuid default null,
  p_audience text default 'organization', p_member_ids uuid[] default '{}'::uuid[]
) returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_id uuid; v_uid uuid:=auth.uid(); v_member uuid;
begin
  if v_uid is null or not public.is_org_member(p_organization_id) then raise exception 'Not authorized'; end if;
  if not public.member_has_permission('chat.create',v_uid) then raise exception 'Chat creation permission required'; end if;
  if p_kind not in ('channel','group','direct') then raise exception 'Invalid conversation kind'; end if;
  if p_audience not in ('organization','members','admins') then raise exception 'Invalid audience'; end if;
  if p_audience='admins' and not public.is_org_admin(p_organization_id) then raise exception 'Admin access required'; end if;
  if nullif(btrim(p_title),'') is null and p_kind<>'direct' then raise exception 'Title required'; end if;
  if p_project_id is not null and not exists(select 1 from public.projects p where p.id=p_project_id and p.organization_id=p_organization_id) then raise exception 'Project not found'; end if;
  insert into public.chat_conversations(organization_id,project_id,kind,title,created_by,audience) values(p_organization_id,p_project_id,p_kind,nullif(btrim(p_title),''),v_uid,p_audience) returning id into v_id;
  insert into public.chat_members(conversation_id,organization_id,user_id) values(v_id,p_organization_id,v_uid) on conflict(conversation_id,user_id) do nothing;
  if p_audience='members' or p_kind in ('group','direct') then
    foreach v_member in array coalesce(p_member_ids,'{}'::uuid[]) loop
      if public.chat_user_is_org_member(p_organization_id,v_member) then insert into public.chat_members(conversation_id,organization_id,user_id) values(v_id,p_organization_id,v_member) on conflict(conversation_id,user_id) do nothing; end if;
    end loop;
  end if;
  return v_id;
end;$$;
revoke all on function public.chat_create_conversation(uuid,text,text,uuid,text,uuid[]) from public;
grant execute on function public.chat_create_conversation(uuid,text,text,uuid,text,uuid[]) to authenticated;
