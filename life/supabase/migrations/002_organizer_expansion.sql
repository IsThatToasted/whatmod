-- JustGlance Organizer Expansion v2.0
-- Safe to run after 001_initial_schema.sql.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  status text not null default 'active' check (status in ('active','paused','completed','archived')),
  priority public.item_priority not null default 'normal',
  icon text not null default 'folder',
  color text,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  archived_at timestamptz
);

alter table public.items add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.items add column if not exists parent_item_id uuid references public.items(id) on delete cascade;
alter table public.items add column if not exists start_date date;
alter table public.items add column if not exists scheduled_at timestamptz;
alter table public.items add column if not exists defer_until timestamptz;
alter table public.items add column if not exists energy_level text check (energy_level is null or energy_level in ('low','medium','high'));
alter table public.items add column if not exists waiting_for text;
alter table public.items add column if not exists is_inbox boolean not null default false;
alter table public.items add column if not exists focus_pin boolean not null default false;
alter table public.items add column if not exists sort_order numeric(12,3) not null default 0;

alter table public.events add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.notes add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.notes add column if not exists pinned boolean not null default false;
alter table public.notes add column if not exists color text;
alter table public.notes add column if not exists source_text text;

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid references public.items(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  body text,
  remind_at timestamptz not null,
  kind text not null default 'notification' check (kind in ('notification','alarm')),
  delivered_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists projects_user_status_idx on public.projects(user_id,status,updated_at desc);
create index if not exists projects_space_status_idx on public.projects(space_id,status) where space_id is not null;
create index if not exists items_project_status_idx on public.items(project_id,status) where deleted_at is null and project_id is not null;
create index if not exists items_inbox_idx on public.items(user_id,is_inbox,status) where deleted_at is null;
create index if not exists items_defer_idx on public.items(user_id,defer_until) where deleted_at is null and defer_until is not null;
create index if not exists events_project_date_idx on public.events(project_id,event_date) where deleted_at is null and project_id is not null;
create index if not exists notes_project_idx on public.notes(project_id,created_at desc) where deleted_at is null and project_id is not null;
create index if not exists reminders_user_time_idx on public.reminders(user_id,remind_at) where dismissed_at is null;

alter table public.projects enable row level security;
alter table public.reminders enable row level security;

drop policy if exists projects_select_access on public.projects;
create policy projects_select_access on public.projects for select
using (user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));

drop policy if exists projects_insert_access on public.projects;
create policy projects_insert_access on public.projects for insert
with check (user_id=auth.uid() and (space_id is null or public.is_space_member(space_id)));

drop policy if exists projects_update_access on public.projects;
create policy projects_update_access on public.projects for update
using (user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)))
with check (user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));

drop policy if exists projects_delete_access on public.projects;
create policy projects_delete_access on public.projects for delete
using (user_id=auth.uid() or (space_id is not null and public.can_manage_space(space_id)));

drop policy if exists reminders_self on public.reminders;
create policy reminders_self on public.reminders for all
using (user_id=auth.uid()) with check (user_id=auth.uid());

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();

-- Existing policies on items/events/notes already gate access by owner or shared-space membership.
-- The new project foreign keys therefore inherit the same access boundary.

do $$ begin
  alter publication supabase_realtime add table public.projects;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.reminders;
exception when duplicate_object then null; end $$;
