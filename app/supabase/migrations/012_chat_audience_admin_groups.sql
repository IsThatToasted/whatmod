-- Aurelium Field v0.12.0
-- Chat audience controls, admin-only conversations, member-managed groups.
-- Apply after 011_smart_scanner_blueprint_estimates.sql.

alter table public.chat_conversations
  add column if not exists audience text not null default 'organization';

alter table public.chat_conversations
  drop constraint if exists chat_conversations_audience_check;
alter table public.chat_conversations
  add constraint chat_conversations_audience_check
  check (audience in ('organization','members','admins'));

create index if not exists chat_conversations_org_audience_idx
  on public.chat_conversations(organization_id,audience,updated_at desc);

-- Access is centralized here so RLS never recursively queries itself.
create or replace function public.chat_can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.chat_conversations c
    where c.id = p_conversation_id
      and public.is_org_member(c.organization_id)
      and (
        c.created_by = auth.uid()
        or public.is_org_admin(c.organization_id)
        or (c.audience = 'organization')
        or (c.audience = 'admins' and public.is_org_admin(c.organization_id))
        or (
          c.audience = 'members'
          and exists (
            select 1 from public.chat_members cm
            where cm.conversation_id = c.id
              and cm.user_id = auth.uid()
          )
        )
        -- Preserve historical direct/group membership semantics.
        or (
          c.kind in ('direct','group')
          and exists (
            select 1 from public.chat_members cm
            where cm.conversation_id = c.id
              and cm.user_id = auth.uid()
          )
        )
      )
  );
$$;

revoke all on function public.chat_can_access_conversation(uuid) from public;
grant execute on function public.chat_can_access_conversation(uuid) to authenticated;

-- Keep INSERT policy aligned with the new audience field.
drop policy if exists chat_conversations_org_insert on public.chat_conversations;
create policy chat_conversations_org_insert
on public.chat_conversations
for insert to authenticated
with check (
  created_by = auth.uid()
  and public.is_org_member(organization_id)
  and audience in ('organization','members','admins')
  and (audience <> 'admins' or public.is_org_admin(organization_id))
  and (
    project_id is null
    or exists (
      select 1 from public.projects p
      where p.id = project_id
        and p.organization_id = organization_id
    )
  )
);

-- Atomic creation supports organization-wide, selected-member, and admin-only chats.
create or replace function public.chat_create_conversation(
  p_organization_id uuid,
  p_title text,
  p_kind text default 'channel',
  p_project_id uuid default null,
  p_audience text default 'organization',
  p_member_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
  v_member uuid;
begin
  if v_uid is null or not public.is_org_member(p_organization_id) then
    raise exception 'Not authorized';
  end if;

  if p_kind not in ('channel','group','direct') then
    raise exception 'Invalid conversation kind';
  end if;

  if p_audience not in ('organization','members','admins') then
    raise exception 'Invalid audience';
  end if;

  if p_audience = 'admins' and not public.is_org_admin(p_organization_id) then
    raise exception 'Admin access required';
  end if;

  if nullif(btrim(p_title),'') is null and p_kind <> 'direct' then
    raise exception 'Title required';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.organization_id = p_organization_id
  ) then
    raise exception 'Project not found';
  end if;

  insert into public.chat_conversations(
    organization_id, project_id, kind, title, created_by, audience
  ) values (
    p_organization_id, p_project_id, p_kind,
    nullif(btrim(p_title),''), v_uid, p_audience
  ) returning id into v_id;

  insert into public.chat_members(conversation_id,organization_id,user_id)
  values(v_id,p_organization_id,v_uid)
  on conflict (conversation_id,user_id) do nothing;

  if p_audience = 'members' or p_kind in ('group','direct') then
    foreach v_member in array coalesce(p_member_ids,'{}'::uuid[]) loop
      if public.chat_user_is_org_member(p_organization_id,v_member) then
        insert into public.chat_members(conversation_id,organization_id,user_id)
        values(v_id,p_organization_id,v_member)
        on conflict (conversation_id,user_id) do nothing;
      end if;
    end loop;
  end if;

  return v_id;
end;
$$;

revoke all on function public.chat_create_conversation(uuid,text,text,uuid,text,uuid[]) from public;
grant execute on function public.chat_create_conversation(uuid,text,text,uuid,text,uuid[]) to authenticated;

-- Admins and conversation creators can add/remove organization members later.
create or replace function public.chat_set_members(
  p_conversation_id uuid,
  p_member_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_org uuid;
  v_creator uuid;
  v_member uuid;
begin
  select organization_id,created_by into v_org,v_creator
  from public.chat_conversations where id=p_conversation_id;

  if v_org is null then raise exception 'Conversation not found'; end if;
  if auth.uid() <> v_creator and not public.is_org_admin(v_org) then
    raise exception 'Not authorized';
  end if;

  delete from public.chat_members
  where conversation_id=p_conversation_id
    and user_id <> v_creator;

  foreach v_member in array coalesce(p_member_ids,'{}'::uuid[]) loop
    if public.chat_user_is_org_member(v_org,v_member) then
      insert into public.chat_members(conversation_id,organization_id,user_id)
      values(p_conversation_id,v_org,v_member)
      on conflict (conversation_id,user_id) do nothing;
    end if;
  end loop;
end;
$$;

revoke all on function public.chat_set_members(uuid,uuid[]) from public;
grant execute on function public.chat_set_members(uuid,uuid[]) to authenticated;

-- Compatibility wrapper used by v0.10.x/v0.11 clients.
create or replace function public.chat_create_channel(
  p_organization_id uuid,
  p_title text,
  p_project_id uuid default null
)
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.chat_create_conversation(
    p_organization_id,
    p_title,
    'channel',
    p_project_id,
    'organization',
    '{}'::uuid[]
  );
$$;

revoke all on function public.chat_create_channel(uuid,text,uuid) from public;
grant execute on function public.chat_create_channel(uuid,text,uuid) to authenticated;

-- Blueprint review state introduced in v0.12.0. Existing analyses remain valid.
alter table public.blueprint_estimates
  add column if not exists assumptions jsonb not null default '{}'::jsonb,
  add column if not exists reviewed_at timestamptz;
