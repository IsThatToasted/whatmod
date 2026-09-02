-- Aurelium Field v0.10.0: payroll profiles, team chat, and editable walkthrough estimate metadata.

create table if not exists public.payroll_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  pay_period_type text not null default 'weekly' check (pay_period_type in ('weekly','biweekly')),
  week_start smallint not null default 1 check (week_start between 0 and 6),
  week_end smallint not null default 0 check (week_end between 0 and 6),
  biweekly_anchor date not null default current_date,
  overtime_threshold_hours numeric(6,2) not null default 40,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.payroll_settings enable row level security;
drop policy if exists payroll_settings_member_select on public.payroll_settings;
create policy payroll_settings_member_select on public.payroll_settings for select to authenticated
using (public.is_org_member(organization_id));
drop policy if exists payroll_settings_admin_write on public.payroll_settings;
create policy payroll_settings_admin_write on public.payroll_settings for all to authenticated
using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create table if not exists public.employee_profiles (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  legal_first_name text,
  legal_middle_name text,
  legal_last_name text,
  position_title text,
  phone text,
  email text,
  street_address text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country text default 'US',
  employment_status text not null default 'active',
  hire_date date,
  employee_number text,
  pay_classification text not null default 'hourly' check (pay_classification in ('hourly','salary')),
  hourly_rate numeric(12,2),
  overtime_eligible boolean not null default true,
  standard_weekly_hours numeric(6,2) not null default 40,
  department text,
  supervisor_user_id uuid references auth.users(id) on delete set null,
  emergency_contact_name text,
  emergency_contact_phone text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (organization_id,user_id)
);
alter table public.employee_profiles enable row level security;
drop policy if exists employee_profiles_self_or_admin_select on public.employee_profiles;
create policy employee_profiles_self_or_admin_select on public.employee_profiles for select to authenticated
using (user_id=auth.uid() or public.is_org_admin(organization_id));
drop policy if exists employee_profiles_admin_write on public.employee_profiles;
create policy employee_profiles_admin_write on public.employee_profiles for all to authenticated
using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  kind text not null default 'channel' check (kind in ('direct','group','channel')),
  title text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.chat_members (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  body text not null check (char_length(body) between 1 and 10000),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.chat_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 32),
  created_at timestamptz not null default now(),
  primary key(message_id,user_id,emoji)
);
create table if not exists public.chat_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
alter table public.chat_attachments enable row level security;
drop policy if exists chat_attachments_member_select on public.chat_attachments;
create policy chat_attachments_member_select on public.chat_attachments for select to authenticated
using (exists(select 1 from public.chat_messages m join public.chat_members cm on cm.conversation_id=m.conversation_id where m.id=message_id and cm.user_id=auth.uid()));
drop policy if exists chat_attachments_sender_insert on public.chat_attachments;
create policy chat_attachments_sender_insert on public.chat_attachments for insert to authenticated
with check (exists(select 1 from public.chat_messages m where m.id=message_id and m.sender_id=auth.uid()));

create index if not exists chat_messages_conversation_created_idx on public.chat_messages(conversation_id,created_at);
create index if not exists chat_members_user_idx on public.chat_members(user_id,conversation_id);

alter table public.chat_conversations enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reactions enable row level security;

drop policy if exists chat_conversations_member_select on public.chat_conversations;
create policy chat_conversations_member_select on public.chat_conversations for select to authenticated
using (exists(select 1 from public.chat_members cm where cm.conversation_id=id and cm.user_id=auth.uid()));
drop policy if exists chat_conversations_org_insert on public.chat_conversations;
create policy chat_conversations_org_insert on public.chat_conversations for insert to authenticated
with check (created_by=auth.uid() and public.is_org_member(organization_id));
drop policy if exists chat_conversations_creator_admin_update on public.chat_conversations;
create policy chat_conversations_creator_admin_update on public.chat_conversations for update to authenticated
using (created_by=auth.uid() or public.is_org_admin(organization_id));

drop policy if exists chat_members_member_select on public.chat_members;
create policy chat_members_member_select on public.chat_members for select to authenticated
using (public.is_org_member(organization_id));
drop policy if exists chat_members_manage on public.chat_members;
create policy chat_members_manage on public.chat_members for all to authenticated
using (public.is_org_admin(organization_id) or exists(select 1 from public.chat_conversations c where c.id=conversation_id and c.created_by=auth.uid()))
with check (public.is_org_member(organization_id));

drop policy if exists chat_messages_member_select on public.chat_messages;
create policy chat_messages_member_select on public.chat_messages for select to authenticated
using (exists(select 1 from public.chat_members cm where cm.conversation_id=chat_messages.conversation_id and cm.user_id=auth.uid()));
drop policy if exists chat_messages_member_insert on public.chat_messages;
create policy chat_messages_member_insert on public.chat_messages for insert to authenticated
with check (sender_id=auth.uid() and exists(select 1 from public.chat_members cm where cm.conversation_id=chat_messages.conversation_id and cm.user_id=auth.uid()));
drop policy if exists chat_messages_sender_admin_update on public.chat_messages;
create policy chat_messages_sender_admin_update on public.chat_messages for update to authenticated
using (sender_id=auth.uid() or public.is_org_admin(organization_id));

drop policy if exists chat_reactions_member_select on public.chat_reactions;
create policy chat_reactions_member_select on public.chat_reactions for select to authenticated
using (exists(select 1 from public.chat_members cm join public.chat_messages m on m.conversation_id=cm.conversation_id where m.id=message_id and cm.user_id=auth.uid()));
drop policy if exists chat_reactions_self_write on public.chat_reactions;
create policy chat_reactions_self_write on public.chat_reactions for all to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid() and public.is_org_member(organization_id));

alter table public.walkthrough_scans add column if not exists scope_lines jsonb;
alter table public.walkthrough_scans add column if not exists estimate_notes text;
alter table public.walkthrough_scans add column if not exists edited_at timestamptz;
alter table public.walkthrough_scans add column if not exists edited_by uuid references auth.users(id) on delete set null;

-- Existing walkthrough policy already provides organization-scoped write access; archived protection remains an application rule.

grant select,insert,update on public.payroll_settings to authenticated;
grant select,insert,update on public.employee_profiles to authenticated;
grant select,insert,update on public.chat_conversations to authenticated;
grant select,insert,update,delete on public.chat_members to authenticated;
grant select,insert,update on public.chat_messages to authenticated;
grant select,insert,delete on public.chat_reactions to authenticated;
grant select,insert on public.chat_attachments to authenticated;
