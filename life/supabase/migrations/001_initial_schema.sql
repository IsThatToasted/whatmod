-- JustGlance production schema
-- Run in Supabase SQL editor or through `supabase db push`.
create extension if not exists pgcrypto;

create type public.space_role as enum ('owner','admin','member');
create type public.item_status as enum ('open','completed','dismissed');
create type public.item_priority as enum ('low','normal','high');
create type public.item_type as enum ('task','shopping','call','errand','reminder','idea','chore');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default 'User',
  greeting_name text not null default 'there',
  avatar_url text,
  timezone text not null default 'America/New_York',
  wake_time time not null default '07:00',
  sleep_time time not null default '23:00',
  work_start time,
  work_end time,
  work_days smallint[] not null default array[1,2,3,4,5],
  theme text not null default 'system' check (theme in ('light','dark','system')),
  week_starts_on smallint not null default 0 check (week_starts_on between 0 and 6),
  time_format text not null default '12h' check (time_format in ('12h','24h')),
  onboarding_complete boolean not null default false,
  help_areas text[] not null default array['Everything'],
  location_permission_state text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  icon text not null default 'home',
  is_personal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.space_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (space_id,user_id)
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null default 'other',
  address text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  radius_meters integer not null default 200 check (radius_meters between 25 and 10000),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  description text,
  type public.item_type not null default 'task',
  status public.item_status not null default 'open',
  priority public.item_priority not null default 'normal',
  due_date date,
  due_time time,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 1440),
  place_id uuid references public.places(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  recurrence_rule text,
  context_tags text[] not null default '{}',
  source_text text,
  parser_result jsonb,
  snoozed_until timestamptz,
  snooze_count integer not null default 0 check (snooze_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

-- Optional extension data for shopping-specific attributes while the base item remains canonical.
create table public.shopping_items (
  item_id uuid primary key references public.items(id) on delete cascade,
  quantity numeric(10,2),
  unit text,
  preferred_store text,
  estimated_price numeric(12,2) check (estimated_price is null or estimated_price >= 0),
  aisle_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  event_date date not null,
  start_time time not null,
  end_time time,
  location text,
  notes text,
  attendees jsonb not null default '[]'::jsonb,
  recurrence_rule text,
  provider text not null default 'internal',
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  title text not null,
  type public.item_type not null default 'task',
  recurrence_rule text not null,
  default_time time,
  estimated_minutes integer,
  priority public.item_priority not null default 'normal',
  enabled boolean not null default true,
  last_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  title text not null default 'Note',
  body text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.item_history (
  id bigint generated by default as identity primary key,
  item_id uuid not null references public.items(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  morning_brief_enabled boolean not null default true,
  daily_reset_enabled boolean not null default true,
  smart_suggestions_enabled boolean not null default true,
  urgent_reminders_enabled boolean not null default true,
  upcoming_tasks_enabled boolean not null default true,
  shared_activity_enabled boolean not null default true,
  location_reminders_enabled boolean not null default false,
  routine_reminders_enabled boolean not null default true,
  default_mood text not null default 'nothing',
  feature_overrides jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  summary_date date not null,
  completed_count integer not null default 0,
  carried_count integer not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id,summary_date)
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_title text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  invite_email text,
  role public.space_role not null default 'member',
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.device_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_key text not null,
  platform text not null default 'web',
  notification_preferences jsonb not null default '{}'::jsonb,
  push_token text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id,device_key)
);

create index items_user_status_due_idx on public.items(user_id,status,due_date) where deleted_at is null;
create index items_space_status_idx on public.items(space_id,status) where deleted_at is null;
create index items_assigned_idx on public.items(assigned_to,status) where deleted_at is null;
create index items_place_idx on public.items(place_id,status) where deleted_at is null;
create index items_tags_gin_idx on public.items using gin(context_tags);
create index events_user_date_idx on public.events(user_id,event_date,start_time) where deleted_at is null;
create index events_space_date_idx on public.events(space_id,event_date) where deleted_at is null;
create index notes_user_idx on public.notes(user_id,created_at desc) where deleted_at is null;
create index activity_user_idx on public.activity_log(user_id,created_at desc);
create index activity_space_idx on public.activity_log(space_id,created_at desc);
create index invites_space_idx on public.invites(space_id,expires_at);
create index places_user_idx on public.places(user_id,name);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger spaces_updated before update on public.spaces for each row execute function public.set_updated_at();

create or replace function public.protect_space_identity() returns trigger language plpgsql as $$
begin
  if new.owner_id is distinct from old.owner_id then raise exception 'Space owner cannot be changed directly'; end if;
  if new.is_personal is distinct from old.is_personal then raise exception 'Personal-space status cannot be changed'; end if;
  return new;
end $$;
create trigger spaces_identity_guard before update on public.spaces for each row execute function public.protect_space_identity();

create or replace function public.protect_space_owner_membership() returns trigger language plpgsql as $$
declare expected_owner uuid; target_space uuid;
begin
  target_space := case when tg_op='DELETE' then old.space_id else new.space_id end;
  select owner_id into expected_owner from public.spaces where id=target_space;
  if tg_op='DELETE' and old.user_id=expected_owner then raise exception 'Space owner membership cannot be deleted'; end if;
  if tg_op='UPDATE' and old.user_id=expected_owner and (new.user_id is distinct from old.user_id or new.role <> 'owner') then raise exception 'Space owner membership cannot be changed'; end if;
  if tg_op in ('INSERT','UPDATE') and new.role='owner' and new.user_id<>expected_owner then raise exception 'Owner role is reserved for the space owner'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger space_members_owner_guard before insert or update or delete on public.space_members for each row execute function public.protect_space_owner_membership();

create trigger places_updated before update on public.places for each row execute function public.set_updated_at();
create trigger items_updated before update on public.items for each row execute function public.set_updated_at();

create or replace function public.protect_item_identity() returns trigger language plpgsql as $$
begin
  if tg_op='UPDATE' and new.user_id is distinct from old.user_id then raise exception 'Item creator cannot be changed'; end if;
  if tg_op='UPDATE' and new.space_id is distinct from old.space_id and old.user_id<>auth.uid() then raise exception 'Only the item creator can move it between spaces'; end if;
  if new.assigned_to is not null and new.space_id is null and new.assigned_to<>new.user_id then raise exception 'Personal items cannot be assigned to another user'; end if;
  if new.assigned_to is not null and new.space_id is not null and not exists(select 1 from public.space_members m where m.space_id=new.space_id and m.user_id=new.assigned_to) then raise exception 'Assignee must belong to the shared space'; end if;
  return new;
end $$;
create trigger items_identity_guard before insert or update on public.items for each row execute function public.protect_item_identity();

create trigger shopping_updated before update on public.shopping_items for each row execute function public.set_updated_at();
create trigger events_updated before update on public.events for each row execute function public.set_updated_at();
create trigger routines_updated before update on public.routines for each row execute function public.set_updated_at();
create trigger notes_updated before update on public.notes for each row execute function public.set_updated_at();

create or replace function public.protect_creator_identity() returns trigger language plpgsql as $$
begin
  if new.user_id is distinct from old.user_id then raise exception 'Creator cannot be changed'; end if;
  return new;
end $$;
create trigger events_creator_guard before update on public.events for each row execute function public.protect_creator_identity();
create trigger routines_creator_guard before update on public.routines for each row execute function public.protect_creator_identity();
create trigger notes_creator_guard before update on public.notes for each row execute function public.protect_creator_identity();

create trigger preferences_updated before update on public.user_preferences for each row execute function public.set_updated_at();

create or replace function public.is_space_member(p_space uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.space_members m where m.space_id=p_space and m.user_id=auth.uid())
$$;
create or replace function public.can_manage_space(p_space uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.space_members m where m.space_id=p_space and m.user_id=auth.uid() and m.role in ('owner','admin'))
$$;

create or replace function public.get_accessible_space_members()
returns table(space_id uuid, user_id uuid, role public.space_role, display_name text, greeting_name text, avatar_url text)
language sql stable security definer set search_path=public as $$
  select m.space_id, m.user_id, m.role, p.display_name, p.greeting_name, p.avatar_url
  from public.space_members m
  join public.profiles p on p.id=m.user_id
  where public.is_space_member(m.space_id)
$$;
revoke all on function public.get_accessible_space_members() from public;
grant execute on function public.get_accessible_space_members() to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
declare p_name text; p_space uuid;
begin
  p_name := coalesce(nullif(new.raw_user_meta_data->>'display_name',''), nullif(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'name',''), split_part(coalesce(new.email,'User'),'@',1), 'User');
  insert into public.profiles(id,email,display_name,greeting_name,timezone)
  values(new.id,new.email,p_name,p_name,coalesce(new.raw_user_meta_data->>'timezone','America/New_York'))
  on conflict(id) do nothing;
  insert into public.user_preferences(user_id) values(new.id) on conflict do nothing;
  insert into public.spaces(owner_id,name,icon,is_personal) values(new.id,'Personal','sparkles',true) returning id into p_space;
  insert into public.space_members(space_id,user_id,role) values(p_space,new.id,'owner');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.create_space_with_owner(p_name text, p_icon text default 'home')
returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if char_length(trim(p_name)) < 1 then raise exception 'Space name is required'; end if;
  insert into public.spaces(owner_id,name,icon) values(auth.uid(),trim(p_name),coalesce(nullif(p_icon,''),'home')) returning id into sid;
  insert into public.space_members(space_id,user_id,role) values(sid,auth.uid(),'owner');
  return sid;
end $$;
revoke all on function public.create_space_with_owner(text,text) from public;
grant execute on function public.create_space_with_owner(text,text) to authenticated;

create or replace function public.create_space_invite(p_space uuid, p_email text default null, p_role public.space_role default 'member')
returns text language plpgsql security definer set search_path=public as $$
declare raw_token text; hashed text;
begin
  if not public.can_manage_space(p_space) then raise exception 'Not allowed'; end if;
  if p_role='owner' then raise exception 'Owner role cannot be invited'; end if;
  raw_token := encode(gen_random_bytes(24),'hex'); hashed := encode(digest(raw_token,'sha256'),'hex');
  insert into public.invites(space_id,created_by,invite_email,role,token_hash) values(p_space,auth.uid(),lower(nullif(trim(p_email),'')),p_role,hashed);
  return raw_token;
end $$;
revoke all on function public.create_space_invite(uuid,text,public.space_role) from public;
grant execute on function public.create_space_invite(uuid,text,public.space_role) to authenticated;

create or replace function public.consume_space_invite(p_token text)
returns uuid language plpgsql security definer set search_path=public as $$
declare inv public.invites%rowtype; hashed text; current_email text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  hashed := encode(digest(p_token,'sha256'),'hex');
  select * into inv from public.invites where token_hash=hashed and accepted_at is null and expires_at>now() for update;
  if not found then raise exception 'Invite is invalid or expired'; end if;
  select lower(email) into current_email from public.profiles where id=auth.uid();
  if inv.invite_email is not null and lower(inv.invite_email) <> current_email then raise exception 'Invite belongs to another email'; end if;
  if exists(select 1 from public.spaces where id=inv.space_id and is_personal) then raise exception 'Personal spaces cannot be shared'; end if;
  insert into public.space_members(space_id,user_id,role) values(inv.space_id,auth.uid(),inv.role)
    on conflict(space_id,user_id) do update set role=excluded.role;
  update public.invites set accepted_by=auth.uid(),accepted_at=now() where id=inv.id;
  return inv.space_id;
end $$;
revoke all on function public.consume_space_invite(text) from public;
grant execute on function public.consume_space_invite(text) to authenticated;

create or replace function public.get_space_members(p_space uuid)
returns table(user_id uuid, display_name text, avatar_url text, role public.space_role)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_space_member(p_space) then raise exception 'Not allowed'; end if;
  return query
    select m.user_id,p.display_name,p.avatar_url,m.role
    from public.space_members m
    join public.profiles p on p.id=m.user_id
    where m.space_id=p_space
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,p.display_name;
end $$;
revoke all on function public.get_space_members(uuid) from public;
grant execute on function public.get_space_members(uuid) to authenticated;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path=public,auth as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from auth.users where id=auth.uid();
end $$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

create or replace function public.log_item_history() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.item_history(item_id,actor_id,action,new_values) values(new.id,auth.uid(),'created',to_jsonb(new));
    return new;
  elsif tg_op='UPDATE' then
    insert into public.item_history(item_id,actor_id,action,old_values,new_values) values(new.id,auth.uid(),case when old.status <> new.status and new.status='completed' then 'completed' else 'updated' end,to_jsonb(old),to_jsonb(new));
    return new;
  end if;
  return new;
end $$;
create trigger items_history after insert or update on public.items for each row execute function public.log_item_history();

create or replace function public.log_item_activity() returns trigger
language plpgsql security definer set search_path=public as $$
declare actor text; action_name text;
begin
  select greeting_name into actor from public.profiles where id=auth.uid();
  action_name := case when tg_op='INSERT' then 'added' when new.status='completed' and old.status is distinct from new.status then 'completed' else 'updated' end;
  insert into public.activity_log(user_id,space_id,actor_id,actor_name,action,entity_type,entity_id,entity_title)
  values(new.user_id,new.space_id,auth.uid(),actor,action_name,new.type::text,new.id,new.title);
  return new;
end $$;
create trigger items_activity after insert or update on public.items for each row execute function public.log_item_activity();

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.places enable row level security;
alter table public.items enable row level security;
alter table public.shopping_items enable row level security;
alter table public.events enable row level security;
alter table public.routines enable row level security;
alter table public.notes enable row level security;
alter table public.item_history enable row level security;
alter table public.user_preferences enable row level security;
alter table public.daily_summaries enable row level security;
alter table public.activity_log enable row level security;
alter table public.invites enable row level security;
alter table public.notifications enable row level security;
alter table public.device_preferences enable row level security;

create policy profiles_select_self on public.profiles for select using (id=auth.uid());
create policy profiles_update_self on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());

create policy spaces_select_member on public.spaces for select using(public.is_space_member(id));
create policy spaces_update_admin on public.spaces for update using(public.can_manage_space(id)) with check(public.can_manage_space(id));
create policy spaces_delete_owner on public.spaces for delete using(owner_id=auth.uid() and not is_personal);

create policy members_select_member on public.space_members for select using(public.is_space_member(space_id));
create policy members_insert_admin on public.space_members for insert with check(public.can_manage_space(space_id));
create policy members_update_admin on public.space_members for update using(public.can_manage_space(space_id)) with check(public.can_manage_space(space_id));
create policy members_delete_admin_or_self on public.space_members for delete using(user_id=auth.uid() or public.can_manage_space(space_id));

create policy places_owner_all on public.places for all using(user_id=auth.uid()) with check(user_id=auth.uid());

create policy items_select_access on public.items for select using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy items_insert_access on public.items for insert with check(user_id=auth.uid() and (space_id is null or public.is_space_member(space_id)) and (assigned_to is null or space_id is not null));
create policy items_update_access on public.items for update using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id))) with check(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy items_delete_access on public.items for delete using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));

create policy shopping_select_access on public.shopping_items for select using(exists(select 1 from public.items i where i.id=item_id and (i.user_id=auth.uid() or public.is_space_member(i.space_id))));
create policy shopping_write_access on public.shopping_items for all using(exists(select 1 from public.items i where i.id=item_id and (i.user_id=auth.uid() or public.is_space_member(i.space_id)))) with check(exists(select 1 from public.items i where i.id=item_id and (i.user_id=auth.uid() or public.is_space_member(i.space_id))));

create policy events_select_access on public.events for select using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy events_insert_access on public.events for insert with check(user_id=auth.uid() and (space_id is null or public.is_space_member(space_id)));
create policy events_update_access on public.events for update using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id))) with check(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy events_delete_access on public.events for delete using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));

create policy routines_select_access on public.routines for select using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy routines_insert_access on public.routines for insert with check(user_id=auth.uid() and (space_id is null or public.is_space_member(space_id)));
create policy routines_update_access on public.routines for update using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id))) with check(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy routines_delete_access on public.routines for delete using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));

create policy notes_select_access on public.notes for select using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy notes_insert_access on public.notes for insert with check(user_id=auth.uid() and (space_id is null or public.is_space_member(space_id)));
create policy notes_update_access on public.notes for update using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id))) with check(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy notes_delete_access on public.notes for delete using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));

create policy history_select_access on public.item_history for select using(exists(select 1 from public.items i where i.id=item_id and (i.user_id=auth.uid() or public.is_space_member(i.space_id))));
create policy preferences_self on public.user_preferences for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy summaries_self on public.daily_summaries for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy activity_select_access on public.activity_log for select using(user_id=auth.uid() or (space_id is not null and public.is_space_member(space_id)));
create policy invites_select_admin on public.invites for select using(public.can_manage_space(space_id));
create policy invites_delete_admin on public.invites for delete using(public.can_manage_space(space_id));
create policy notifications_self on public.notifications for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy devices_self on public.device_preferences for all using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Enable only the shared/live tables needed by the client.
do $$ begin
  alter publication supabase_realtime add table public.items;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.shopping_items;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.activity_log;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.space_members;
exception when duplicate_object then null; end $$;
