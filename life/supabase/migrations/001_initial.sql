-- JustGlance initial production schema
create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '', greeting_name text not null default '', avatar_url text,
  timezone text not null default 'UTC', wake_time time not null default '07:00', sleep_time time not null default '23:00',
  work_days int[] not null default '{1,2,3,4,5}', work_start time, work_end time,
  theme text not null default 'system' check(theme in ('light','dark','system')),
  week_start int not null default 0, time_format text not null default '12h', onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,name,greeting_name,timezone)
  values(new.id, coalesce(new.raw_user_meta_data->>'name',''), coalesce(new.raw_user_meta_data->>'name',''), coalesce(new.raw_user_meta_data->>'timezone','UTC'))
  on conflict(id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null, emoji text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger spaces_updated_at before update on public.spaces for each row execute function public.set_updated_at();
create table if not exists public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check(role in ('owner','admin','member')),
  joined_at timestamptz not null default now(), primary key(space_id,user_id)
);
create index if not exists idx_space_members_user on public.space_members(user_id);

create or replace function public.is_space_member(p_space uuid, p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public as $$ select exists(select 1 from public.space_members where space_id=p_space and user_id=p_user) $$;
create or replace function public.is_space_admin(p_space uuid, p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public as $$ select exists(select 1 from public.space_members where space_id=p_space and user_id=p_user and role in ('owner','admin')) $$;

create or replace function public.create_space(space_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid;
begin
  insert into public.spaces(owner_id,name) values(auth.uid(),trim(space_name)) returning id into sid;
  insert into public.space_members(space_id,user_id,role) values(sid,auth.uid(),'owner');
  return sid;
end $$;

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade, name text not null, category text not null default 'other', address text,
  latitude double precision, longitude double precision, radius integer not null default 250, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger places_updated_at before update on public.places for each row execute function public.set_updated_at();
create index if not exists idx_places_user on public.places(user_id);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade, title text not null, description text,
  type text not null default 'task' check(type in ('task','shopping','reminder','chore','idea','call','errand')),
  status text not null default 'open' check(status in ('open','completed','snoozed')),
  priority text not null default 'normal' check(priority in ('low','normal','high')),
  due_date date, due_time time, estimated_minutes integer check(estimated_minutes is null or estimated_minutes > 0),
  place_id uuid references public.places(id) on delete set null, place_name text, assigned_to uuid references auth.users(id) on delete set null,
  recurrence_rule text, context_tags text[] not null default '{}', source_text text, parser_result jsonb,
  postpone_count integer not null default 0, snoozed_until timestamptz, completed_at timestamptz, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger items_updated_at before update on public.items for each row execute function public.set_updated_at();
create index if not exists idx_items_user_status on public.items(user_id,status) where deleted_at is null;
create index if not exists idx_items_space on public.items(space_id) where deleted_at is null;
create index if not exists idx_items_due on public.items(due_date,due_time) where deleted_at is null and status <> 'completed';
create index if not exists idx_items_tags on public.items using gin(context_tags);
create index if not exists idx_items_search on public.items using gin(to_tsvector('english',coalesce(title,'')||' '||coalesce(description,'')||' '||coalesce(source_text,'')));

create table if not exists public.item_history (
  id uuid primary key default gen_random_uuid(), item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action text not null, before_state jsonb, after_state jsonb, created_at timestamptz not null default now()
);
create index if not exists idx_item_history_item on public.item_history(item_id,created_at desc);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade, item_id uuid references public.items(id) on delete cascade,
  name text not null, quantity text, category text, preferred_store text, notes text, assigned_to uuid references auth.users(id) on delete set null,
  completed boolean not null default false, recurrence_rule text, estimated_price numeric(10,2), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger shopping_items_updated_at before update on public.shopping_items for each row execute function public.set_updated_at();
create index if not exists idx_shopping_space on public.shopping_items(space_id,completed);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade, title text not null, start_at timestamptz not null, end_at timestamptz,
  location text, notes text, attendees jsonb not null default '[]', recurrence_rule text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger events_updated_at before update on public.events for each row execute function public.set_updated_at();
create index if not exists idx_events_user_start on public.events(user_id,start_at);

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade, title text not null, type text not null default 'task', recurrence_rule text not null,
  preferred_time time, enabled boolean not null default true, metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger routines_updated_at before update on public.routines for each row execute function public.set_updated_at();

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade, title text, body text not null, tags text[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create trigger notes_updated_at before update on public.notes for each row execute function public.set_updated_at();
create index if not exists idx_notes_search on public.notes using gin(to_tsvector('english',coalesce(title,'')||' '||body));

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade, mood_default text, notification_settings jsonb not null default '{}',
  feature_flags jsonb not null default '{}', updated_at timestamptz not null default now()
);
create trigger user_preferences_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();
create table if not exists public.daily_summaries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  summary_date date not null, completed_count integer not null default 0, carried_count integer not null default 0, summary jsonb not null default '{}',
  created_at timestamptz not null default now(), unique(user_id,summary_date)
);
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(), actor_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade, action text not null, summary text not null, entity_type text, entity_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_space on public.activity_log(space_id,created_at desc);
create index if not exists idx_activity_actor on public.activity_log(actor_id,created_at desc);
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(), space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade, email text, token_hash text not null,
  role text not null default 'member' check(role in ('admin','member')), expires_at timestamptz not null default(now()+interval '7 days'), accepted_at timestamptz, created_at timestamptz not null default now()
);
create unique index if not exists idx_invites_token on public.invites(token_hash);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null, title text not null, body text, read_at timestamptz, scheduled_for timestamptz, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.device_preferences (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  device_key text not null, push_enabled boolean not null default false, permission_state text, metadata jsonb not null default '{}', updated_at timestamptz not null default now(), unique(user_id,device_key)
);
create trigger device_preferences_updated_at before update on public.device_preferences for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.spaces enable row level security; alter table public.space_members enable row level security;
alter table public.items enable row level security; alter table public.item_history enable row level security;
alter table public.shopping_items enable row level security; alter table public.places enable row level security;
alter table public.events enable row level security; alter table public.routines enable row level security; alter table public.notes enable row level security;
alter table public.user_preferences enable row level security; alter table public.daily_summaries enable row level security;
alter table public.activity_log enable row level security; alter table public.invites enable row level security;
alter table public.notifications enable row level security; alter table public.device_preferences enable row level security;

create policy "profiles self select" on public.profiles for select using(id=auth.uid());
create policy "profiles self update" on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy "spaces members read" on public.spaces for select using(public.is_space_member(id));
create policy "spaces owner insert" on public.spaces for insert with check(owner_id=auth.uid());
create policy "spaces admins update" on public.spaces for update using(public.is_space_admin(id));
create policy "spaces owner delete" on public.spaces for delete using(owner_id=auth.uid());
create policy "members same space read" on public.space_members for select using(public.is_space_member(space_id));
create policy "members admins insert" on public.space_members for insert with check(public.is_space_admin(space_id));
create policy "members admins update" on public.space_members for update using(public.is_space_admin(space_id));
create policy "members admins delete" on public.space_members for delete using(public.is_space_admin(space_id) or user_id=auth.uid());

create policy "items readable" on public.items for select using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy "items insert" on public.items for insert with check(user_id=auth.uid() and (space_id is null or public.is_space_member(space_id)));
create policy "items update" on public.items for update using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id))) with check(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy "items delete" on public.items for delete using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));

create policy "history readable" on public.item_history for select using(user_id=auth.uid() or exists(select 1 from public.items i where i.id=item_id and i.space_id is not null and public.is_space_member(i.space_id)));
create policy "history insert own" on public.item_history for insert with check(user_id=auth.uid());
create policy "shopping readable" on public.shopping_items for select using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy "shopping insert" on public.shopping_items for insert with check(user_id=auth.uid() and (space_id is null or public.is_space_member(space_id)));
create policy "shopping update" on public.shopping_items for update using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy "shopping delete" on public.shopping_items for delete using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));

create policy "places readable" on public.places for select using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy "places insert" on public.places for insert with check(user_id=auth.uid() and (space_id is null or public.is_space_member(space_id)));
create policy "places update" on public.places for update using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy "places delete" on public.places for delete using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy "events readable" on public.events for select using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy "events insert" on public.events for insert with check(user_id=auth.uid() and (space_id is null or public.is_space_member(space_id)));
create policy "events update" on public.events for update using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy "events delete" on public.events for delete using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy "routines own or space" on public.routines for all using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id))) with check(user_id=auth.uid() and (space_id is null or public.is_space_member(space_id)));
create policy "notes own or space" on public.notes for all using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id))) with check(user_id=auth.uid() and (space_id is null or public.is_space_member(space_id)));
create policy "preferences self" on public.user_preferences for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "summaries self" on public.daily_summaries for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "activity readable" on public.activity_log for select using(actor_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy "activity insert" on public.activity_log for insert with check(actor_id=auth.uid() and (space_id is null or public.is_space_member(space_id)));
create policy "invites admins" on public.invites for all using(public.is_space_admin(space_id)) with check(public.is_space_admin(space_id));
create policy "notifications self" on public.notifications for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "devices self" on public.device_preferences for all using(user_id=auth.uid()) with check(user_id=auth.uid());

create or replace view public.spaces_with_membership with (security_invoker=true) as
select s.id,s.name,s.emoji,sm.role,
       (select count(*)::int from public.space_members m where m.space_id=s.id) as member_count
from public.spaces s join public.space_members sm on sm.space_id=s.id where sm.user_id=auth.uid();

grant select on public.spaces_with_membership to authenticated;
grant execute on function public.create_space(text) to authenticated;

-- Realtime tables. Safe to rerun manually if already in publication.
do $$ begin
  alter publication supabase_realtime add table public.items;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.shopping_items;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.activity_log;
exception when duplicate_object then null; end $$;
