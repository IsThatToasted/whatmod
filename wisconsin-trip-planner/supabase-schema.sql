-- Connection Quest / Bedroom Builder schema
-- Safe to run more than once in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.bcc_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text,
  vibe text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bcc_profiles add column if not exists vibe text;

create table if not exists public.bcc_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Connection Quest',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bcc_session_members (
  session_id uuid not null references public.bcc_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'partner' check (role in ('owner','partner')),
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table if not exists public.bcc_answers (
  session_id uuid not null references public.bcc_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  answer_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id, question_id)
);

-- Compact state: one row per user per connection. Avoids storing every XP event.
create table if not exists public.bcc_player_state (
  session_id uuid not null references public.bcc_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  xp integer not null default 0,
  unlocked jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- Compact vault: short text only. Static prompts stay in game-content.json.
create table if not exists public.bcc_user_secrets (
  user_id uuid not null references auth.users(id) on delete cascade,
  secret_id text not null,
  answer_text text not null check (char_length(answer_text) <= 220),
  updated_at timestamptz not null default now(),
  primary key (user_id, secret_id)
);

create or replace function public.bcc_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists bcc_profiles_touch on public.bcc_profiles;
create trigger bcc_profiles_touch before update on public.bcc_profiles for each row execute function public.bcc_touch_updated_at();
drop trigger if exists bcc_sessions_touch on public.bcc_sessions;
create trigger bcc_sessions_touch before update on public.bcc_sessions for each row execute function public.bcc_touch_updated_at();
drop trigger if exists bcc_answers_touch on public.bcc_answers;
create trigger bcc_answers_touch before update on public.bcc_answers for each row execute function public.bcc_touch_updated_at();
drop trigger if exists bcc_player_state_touch on public.bcc_player_state;
create trigger bcc_player_state_touch before update on public.bcc_player_state for each row execute function public.bcc_touch_updated_at();
drop trigger if exists bcc_user_secrets_touch on public.bcc_user_secrets;
create trigger bcc_user_secrets_touch before update on public.bcc_user_secrets for each row execute function public.bcc_touch_updated_at();

create or replace function public.bcc_limit_two_members() returns trigger language plpgsql security definer set search_path = public as $$
declare member_count integer;
begin
  select count(*) into member_count from public.bcc_session_members where session_id = new.session_id;
  if member_count >= 2 then raise exception 'This compatibility quest already has two people.'; end if;
  return new;
end; $$;
drop trigger if exists bcc_limit_two_members_trigger on public.bcc_session_members;
create trigger bcc_limit_two_members_trigger before insert on public.bcc_session_members for each row execute function public.bcc_limit_two_members();

alter table public.bcc_profiles enable row level security;
alter table public.bcc_sessions enable row level security;
alter table public.bcc_session_members enable row level security;
alter table public.bcc_answers enable row level security;
alter table public.bcc_player_state enable row level security;
alter table public.bcc_user_secrets enable row level security;

create or replace function public.bcc_is_session_member(p_session_id uuid, p_user_id uuid) returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.bcc_session_members m where m.session_id = p_session_id and m.user_id = p_user_id);
$$;
create or replace function public.bcc_shares_session_with(p_user_a uuid, p_user_b uuid) returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.bcc_session_members a join public.bcc_session_members b on b.session_id = a.session_id where a.user_id = p_user_a and b.user_id = p_user_b);
$$;

do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname='public' and tablename like 'bcc_%' loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy "bcc profiles own select" on public.bcc_profiles for select to authenticated using (user_id = auth.uid());
create policy "bcc profiles partner select" on public.bcc_profiles for select to authenticated using (public.bcc_shares_session_with(auth.uid(), bcc_profiles.user_id));
create policy "bcc profiles own insert" on public.bcc_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "bcc profiles own update" on public.bcc_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "bcc sessions member select" on public.bcc_sessions for select to authenticated using (owner_id = auth.uid() or public.bcc_is_session_member(id, auth.uid()));
create policy "bcc sessions invite select" on public.bcc_sessions for select to authenticated using (true);
create policy "bcc sessions owner insert" on public.bcc_sessions for insert to authenticated with check (owner_id = auth.uid());
create policy "bcc sessions owner update" on public.bcc_sessions for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "bcc members select" on public.bcc_session_members for select to authenticated using (public.bcc_is_session_member(session_id, auth.uid()) or user_id = auth.uid());
create policy "bcc members insert self" on public.bcc_session_members for insert to authenticated with check (user_id = auth.uid());

create policy "bcc answers select member" on public.bcc_answers for select to authenticated using (public.bcc_is_session_member(session_id, auth.uid()));
create policy "bcc answers insert own" on public.bcc_answers for insert to authenticated with check (user_id = auth.uid() and public.bcc_is_session_member(session_id, auth.uid()));
create policy "bcc answers update own" on public.bcc_answers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "bcc answers delete own" on public.bcc_answers for delete to authenticated using (user_id = auth.uid());

create policy "bcc player select member" on public.bcc_player_state for select to authenticated using (public.bcc_is_session_member(session_id, auth.uid()));
create policy "bcc player upsert own" on public.bcc_player_state for insert to authenticated with check (user_id = auth.uid() and public.bcc_is_session_member(session_id, auth.uid()));
create policy "bcc player update own" on public.bcc_player_state for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "bcc secrets select own" on public.bcc_user_secrets for select to authenticated using (user_id = auth.uid());
create policy "bcc secrets insert own" on public.bcc_user_secrets for insert to authenticated with check (user_id = auth.uid());
create policy "bcc secrets update own" on public.bcc_user_secrets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists bcc_answers_session_idx on public.bcc_answers(session_id);
create index if not exists bcc_members_user_idx on public.bcc_session_members(user_id);
