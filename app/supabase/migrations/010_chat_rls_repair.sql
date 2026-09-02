-- Aurelium Field v0.10.3: repair Chat RLS recursion and make organization channels usable.
-- Apply AFTER 009_payroll_chat_walkthrough_editing.sql.
-- This migration is intentionally idempotent and preserves existing chat data.

-- -----------------------------------------------------------------------------
-- SECURITY-DEFINER HELPERS
-- These helpers centralize Chat access checks and intentionally execute as the
-- migration owner so RLS policies never recursively evaluate one another.
-- -----------------------------------------------------------------------------

create or replace function public.chat_conversation_org(p_conversation_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.organization_id
  from public.chat_conversations c
  where c.id = p_conversation_id
  limit 1;
$$;

create or replace function public.chat_user_is_org_member(p_organization_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = p_user_id
      and m.active = true
  );
$$;

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
        -- Channels are organization-wide by design.
        c.kind = 'channel'
        -- The creator must be able to read a newly inserted direct/group row
        -- before the first chat_members row exists.
        or c.created_by = auth.uid()
        -- Admins/owners retain moderation access.
        or public.is_org_admin(c.organization_id)
        -- Direct/group conversations remain membership scoped.
        or exists (
          select 1
          from public.chat_members cm
          where cm.conversation_id = c.id
            and cm.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.chat_can_manage_conversation(p_conversation_id uuid)
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
      )
  );
$$;

create or replace function public.chat_message_org(p_message_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.organization_id
  from public.chat_messages m
  where m.id = p_message_id
  limit 1;
$$;

create or replace function public.chat_can_access_message(p_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.chat_messages m
    where m.id = p_message_id
      and public.chat_can_access_conversation(m.conversation_id)
  );
$$;

create or replace function public.chat_is_message_sender(p_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.chat_messages m
    where m.id = p_message_id
      and m.sender_id = auth.uid()
  );
$$;

revoke all on function public.chat_conversation_org(uuid) from public;
revoke all on function public.chat_user_is_org_member(uuid, uuid) from public;
revoke all on function public.chat_can_access_conversation(uuid) from public;
revoke all on function public.chat_can_manage_conversation(uuid) from public;
revoke all on function public.chat_message_org(uuid) from public;
revoke all on function public.chat_can_access_message(uuid) from public;
revoke all on function public.chat_is_message_sender(uuid) from public;

grant execute on function public.chat_conversation_org(uuid) to authenticated;
grant execute on function public.chat_user_is_org_member(uuid, uuid) to authenticated;
grant execute on function public.chat_can_access_conversation(uuid) to authenticated;
grant execute on function public.chat_can_manage_conversation(uuid) to authenticated;
grant execute on function public.chat_message_org(uuid) to authenticated;
grant execute on function public.chat_can_access_message(uuid) to authenticated;
grant execute on function public.chat_is_message_sender(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- REPLACE THE RECURSIVE POLICIES FROM MIGRATION 009
-- The original chat_members_manage policy was FOR ALL and queried
-- chat_conversations. During chat_conversations SELECT, its policy queried
-- chat_members, which caused PostgreSQL to recurse back into chat_conversations.
-- -----------------------------------------------------------------------------

drop policy if exists chat_conversations_member_select on public.chat_conversations;
drop policy if exists chat_conversations_org_insert on public.chat_conversations;
drop policy if exists chat_conversations_creator_admin_update on public.chat_conversations;

drop policy if exists chat_members_member_select on public.chat_members;
drop policy if exists chat_members_manage on public.chat_members;
drop policy if exists chat_members_select_repaired on public.chat_members;
drop policy if exists chat_members_insert_repaired on public.chat_members;
drop policy if exists chat_members_self_update_repaired on public.chat_members;
drop policy if exists chat_members_delete_repaired on public.chat_members;

drop policy if exists chat_messages_member_select on public.chat_messages;
drop policy if exists chat_messages_member_insert on public.chat_messages;
drop policy if exists chat_messages_sender_admin_update on public.chat_messages;

drop policy if exists chat_reactions_member_select on public.chat_reactions;
drop policy if exists chat_reactions_self_write on public.chat_reactions;
drop policy if exists chat_reactions_self_insert on public.chat_reactions;
drop policy if exists chat_reactions_self_delete on public.chat_reactions;

drop policy if exists chat_attachments_member_select on public.chat_attachments;
drop policy if exists chat_attachments_sender_insert on public.chat_attachments;

-- Conversations
create policy chat_conversations_member_select
on public.chat_conversations
for select to authenticated
using (public.chat_can_access_conversation(id));

create policy chat_conversations_org_insert
on public.chat_conversations
for insert to authenticated
with check (
  created_by = auth.uid()
  and public.is_org_member(organization_id)
  and (
    project_id is null
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.organization_id = organization_id
    )
  )
);

create policy chat_conversations_creator_admin_update
on public.chat_conversations
for update to authenticated
using (public.chat_can_manage_conversation(id))
with check (
  public.is_org_member(organization_id)
  and (
    created_by = auth.uid()
    or public.is_org_admin(organization_id)
  )
);

-- Membership rows. SELECT no longer participates in a recursive policy cycle.
create policy chat_members_select_repaired
on public.chat_members
for select to authenticated
using (public.chat_can_access_conversation(conversation_id));

create policy chat_members_insert_repaired
on public.chat_members
for insert to authenticated
with check (
  organization_id = public.chat_conversation_org(conversation_id)
  and public.chat_can_manage_conversation(conversation_id)
  and public.chat_user_is_org_member(organization_id, user_id)
);

create policy chat_members_self_update_repaired
on public.chat_members
for update to authenticated
using (
  user_id = auth.uid()
  and public.chat_can_access_conversation(conversation_id)
)
with check (
  user_id = auth.uid()
  and organization_id = public.chat_conversation_org(conversation_id)
  and public.chat_user_is_org_member(organization_id, user_id)
);

create policy chat_members_delete_repaired
on public.chat_members
for delete to authenticated
using (
  user_id = auth.uid()
  or public.chat_can_manage_conversation(conversation_id)
);

-- Messages
create policy chat_messages_member_select
on public.chat_messages
for select to authenticated
using (
  organization_id = public.chat_conversation_org(conversation_id)
  and public.chat_can_access_conversation(conversation_id)
);

create policy chat_messages_member_insert
on public.chat_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and organization_id = public.chat_conversation_org(conversation_id)
  and public.chat_can_access_conversation(conversation_id)
);

create policy chat_messages_sender_admin_update
on public.chat_messages
for update to authenticated
using (
  sender_id = auth.uid()
  or public.is_org_admin(organization_id)
)
with check (
  organization_id = public.chat_conversation_org(conversation_id)
  and public.chat_can_access_conversation(conversation_id)
  and (
    sender_id = auth.uid()
    or public.is_org_admin(organization_id)
  )
);

-- Reactions
create policy chat_reactions_member_select
on public.chat_reactions
for select to authenticated
using (
  organization_id = public.chat_message_org(message_id)
  and public.chat_can_access_message(message_id)
);

create policy chat_reactions_self_insert
on public.chat_reactions
for insert to authenticated
with check (
  user_id = auth.uid()
  and organization_id = public.chat_message_org(message_id)
  and public.chat_can_access_message(message_id)
);

create policy chat_reactions_self_delete
on public.chat_reactions
for delete to authenticated
using (
  user_id = auth.uid()
  and public.chat_can_access_message(message_id)
);

-- Attachments
create policy chat_attachments_member_select
on public.chat_attachments
for select to authenticated
using (
  organization_id = public.chat_message_org(message_id)
  and public.chat_can_access_message(message_id)
);

create policy chat_attachments_sender_insert
on public.chat_attachments
for insert to authenticated
with check (
  organization_id = public.chat_message_org(message_id)
  and public.chat_is_message_sender(message_id)
  and public.chat_can_access_message(message_id)
);

-- Restrict mutable conversation/membership/message columns. Existing grants in
-- 009 were table-wide; narrow UPDATE while preserving required behavior.
revoke update on public.chat_conversations from authenticated;
grant update(title, project_id, updated_at) on public.chat_conversations to authenticated;

revoke update on public.chat_members from authenticated;
grant update(last_read_at) on public.chat_members to authenticated;

revoke update on public.chat_messages from authenticated;
grant update(body, edited_at, deleted_at) on public.chat_messages to authenticated;

-- -----------------------------------------------------------------------------
-- TEAM DIRECTORY FOR CHAT
-- admin_list_members() intentionally requires owner/admin. Chat is an employee
-- feature, so provide a separate organization-scoped directory function.
-- -----------------------------------------------------------------------------

create or replace function public.chat_list_members(p_organization_id uuid)
returns table(
  user_id uuid,
  display_name text,
  email text
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_org_member(p_organization_id) then
    return;
  end if;

  return query
  select
    m.user_id,
    nullif(trim(m.display_name), '') as display_name,
    u.email::text
  from public.organization_members m
  left join auth.users u on u.id = m.user_id
  where m.organization_id = p_organization_id
    and m.active = true
  order by coalesce(nullif(trim(m.display_name), ''), u.email, '') asc;
end;
$$;

revoke all on function public.chat_list_members(uuid) from public;
grant execute on function public.chat_list_members(uuid) to authenticated;

-- Atomic channel creation avoids a partially-created channel if membership
-- bootstrap fails between two client requests. Existing clients using direct
-- table inserts remain supported by the repaired policies above.
create or replace function public.chat_create_channel(
  p_organization_id uuid,
  p_title text,
  p_project_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text := nullif(trim(p_title), '');
  v_conversation_id uuid;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'Organization membership required';
  end if;

  if v_title is null or char_length(v_title) > 120 then
    raise exception 'Invalid channel title';
  end if;

  if p_project_id is not null and not exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.organization_id = p_organization_id
  ) then
    raise exception 'Project does not belong to organization';
  end if;

  insert into public.chat_conversations(
    organization_id,
    project_id,
    kind,
    title,
    created_by
  )
  values(
    p_organization_id,
    p_project_id,
    'channel',
    v_title,
    auth.uid()
  )
  returning id into v_conversation_id;

  insert into public.chat_members(conversation_id, organization_id, user_id)
  values(v_conversation_id, p_organization_id, auth.uid())
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation_id;
end;
$$;

revoke all on function public.chat_create_channel(uuid, text, uuid) from public;
grant execute on function public.chat_create_channel(uuid, text, uuid) to authenticated;

-- Keep conversation ordering fresh for every sender without requiring ordinary
-- channel members to have UPDATE permission on chat_conversations.
create or replace function public.chat_touch_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.chat_conversations
  set updated_at = greatest(updated_at, new.created_at)
  where id = new.conversation_id;
  return new;
end;
$$;

revoke all on function public.chat_touch_conversation_after_message() from public;

drop trigger if exists chat_messages_touch_conversation on public.chat_messages;
create trigger chat_messages_touch_conversation
after insert on public.chat_messages
for each row execute function public.chat_touch_conversation_after_message();
