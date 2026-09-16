-- ============================================================================
-- WhatMod Trivia V14.2 COMPLETE SCHEMA RECONCILER
-- Generated from the attached TriviaApp migration history through V13 plus
-- V14 matchmaking requirements.
--
-- Purpose:
--   * Repair partially-applied historical migrations without deleting data.
--   * Create every required table if missing.
--   * Add every historical column used by the current app if missing.
--   * Restore indexes / RLS / realtime prerequisites.
--   * Then the cumulative runtime migrations below reinstall current RPCs.
--
-- This script intentionally does NOT truncate/reset gameplay or profile data.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Core tables: create a fully-current baseline when a table is absent.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 2 and 24),
  username_customized boolean not null default false,
  avatar_url text,
  xp bigint not null default 0 check (xp >= 0),
  wins integer not null default 0 check (wins >= 0),
  games_played integer not null default 0 check (games_played >= 0),
  daily_streak integer not null default 0 check (daily_streak >= 0),
  last_daily_date date,
  is_admin boolean not null default false,
  ui_theme text not null default 'v2',
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  question_type text not null check (question_type in ('numeric','multiple_choice','text')),
  prompt text not null,
  context text,
  unit text,
  options jsonb,
  answer_numeric numeric,
  answer_text text,
  correct_option integer,
  explanation text,
  source_url text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  image_url text,
  image_alt text,
  image_source_url text,
  image_attribution text,
  image_license text,
  image_license_url text,
  source_type text,
  source_entity_id text,
  canonical_key text,
  media_query text,
  media_provider text,
  media_review_status text not null default 'unreviewed',
  media_locked boolean not null default false,
  media_candidate_id uuid,
  media_updated_at timestamptz,
  media_last_resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  delete_reason text,
  content_locked boolean not null default false
);

create table if not exists public.library_sessions (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  title text not null,
  description text,
  source_kind text not null default 'practice',
  created_by uuid references auth.users(id) on delete set null,
  categories text[] not null default array[]::text[],
  difficulty text not null default 'any',
  question_count integer not null,
  question_ids uuid[] not null,
  cover_image_url text,
  cover_image_alt text,
  cover_image_source_url text,
  cover_image_attribution text,
  cover_image_license text,
  cover_image_license_url text,
  play_count bigint not null default 0,
  times_generated bigint not null default 1,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users(id) on delete cascade,
  title text,
  category text not null default 'Any',
  difficulty text not null default 'any',
  question_count integer not null default 10,
  max_players integer not null default 10,
  game_mode text not null default 'standard',
  seconds_per_question integer not null default 20,
  status text not null default 'lobby',
  current_question_index integer not null default 0,
  question_started_at timestamptz,
  results_started_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  rewards_awarded_at timestamptz,
  library_session_id uuid references public.library_sessions(id) on delete set null,
  visibility text not null default 'invite_only',
  allow_matchmaking boolean not null default false,
  lobby_kind text not null default 'custom',
  matchmaking_target integer not null default 10,
  cycle_no integer not null default 1
);

create table if not exists public.game_players (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  total_score integer not null default 0,
  is_connected boolean not null default true,
  xp_awarded integer not null default 0,
  participation_status text not null default 'active',
  joined_cycle integer not null default 1,
  primary key (game_id,user_id)
);

create table if not exists public.game_questions (
  game_id uuid not null references public.games(id) on delete cascade,
  ordinal integer not null,
  question_id uuid not null references public.questions(id),
  primary key (game_id,ordinal)
);

create table if not exists public.game_answers (
  game_id uuid not null references public.games(id) on delete cascade,
  ordinal integer not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer_value text not null,
  answer_numeric numeric,
  score integer not null default 0,
  response_ms integer not null default 0,
  submitted_at timestamptz not null default now(),
  primary key (game_id,ordinal,user_id)
);

create table if not exists public.daily_attempts (
  day date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  answer_value text not null,
  answer_numeric numeric,
  score integer not null,
  xp_awarded integer not null,
  submitted_at timestamptz not null default now(),
  primary key (day,user_id)
);

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  categories text[] not null default array[]::text[],
  difficulty text not null default 'any',
  question_count integer not null default 10,
  current_index integer not null default 0,
  total_score integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  library_session_id uuid references public.library_sessions(id) on delete set null,
  origin_library_session_id uuid references public.library_sessions(id) on delete set null
);

create table if not exists public.practice_questions (
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  ordinal integer not null,
  question_id uuid not null references public.questions(id),
  primary key(session_id,ordinal)
);

create table if not exists public.practice_answers (
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  ordinal integer not null,
  answer_value text not null,
  answer_numeric numeric,
  score integer not null,
  response_ms integer not null default 0,
  submitted_at timestamptz not null default now(),
  primary key(session_id,ordinal)
);

create table if not exists public.question_answer_stats (
  question_id uuid primary key references public.questions(id) on delete cascade,
  total_answers bigint not null default 0,
  histogram bigint[] not null default array_fill(0::bigint,array[41]),
  first_answered_at timestamptz,
  last_answered_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.question_media_candidates (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  provider text not null,
  provider_key text not null,
  title text,
  image_url text not null,
  thumbnail_url text,
  source_url text,
  creator text,
  creator_url text,
  license text,
  license_url text,
  width integer,
  height integer,
  score numeric not null default 0,
  auto_eligible boolean not null default false,
  is_available boolean not null default true,
  status text not null default 'candidate',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_checked_at timestamptz,
  unique(question_id,provider,provider_key)
);

create table if not exists public.question_votes (
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(question_id,user_id)
);

create table if not exists public.question_audit_log (
  id bigint generated always as identity primary key,
  question_id uuid,
  action text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_username text,
  actor_email text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.game_bots (
  game_id uuid not null references public.games(id) on delete cascade,
  bot_id uuid not null default gen_random_uuid(),
  username text not null,
  skill numeric not null default .55,
  total_score integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (game_id,bot_id)
);

create table if not exists public.game_bot_answers (
  game_id uuid not null references public.games(id) on delete cascade,
  ordinal integer not null,
  bot_id uuid not null,
  answer_value text,
  answer_numeric numeric,
  score integer not null default 0,
  primary key (game_id,ordinal,bot_id),
  foreign key (game_id,bot_id) references public.game_bots(game_id,bot_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- 1. Upgrade columns: CREATE TABLE IF NOT EXISTS does not alter old tables.
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists username_customized boolean not null default false;
alter table public.profiles add column if not exists ui_theme text not null default 'v2';
alter table public.profiles alter column ui_theme set default 'v2';
update public.profiles set ui_theme='v2' where ui_theme is null or ui_theme not in ('v1','v2');

alter table public.questions add column if not exists image_url text;
alter table public.questions add column if not exists image_alt text;
alter table public.questions add column if not exists image_source_url text;
alter table public.questions add column if not exists image_attribution text;
alter table public.questions add column if not exists image_license text;
alter table public.questions add column if not exists image_license_url text;
alter table public.questions add column if not exists source_type text;
alter table public.questions add column if not exists source_entity_id text;
alter table public.questions add column if not exists canonical_key text;
alter table public.questions add column if not exists media_query text;
alter table public.questions add column if not exists media_provider text;
alter table public.questions add column if not exists media_review_status text not null default 'unreviewed';
alter table public.questions add column if not exists media_locked boolean not null default false;
alter table public.questions add column if not exists media_candidate_id uuid;
alter table public.questions add column if not exists media_updated_at timestamptz;
alter table public.questions add column if not exists media_last_resolved_at timestamptz;
alter table public.questions add column if not exists updated_at timestamptz not null default now();
alter table public.questions add column if not exists deleted_at timestamptz;
alter table public.questions add column if not exists deleted_by uuid;
alter table public.questions add column if not exists delete_reason text;
alter table public.questions add column if not exists content_locked boolean not null default false;

alter table public.games add column if not exists library_session_id uuid;
alter table public.games add column if not exists results_started_at timestamptz;
alter table public.games add column if not exists rewards_awarded_at timestamptz;
alter table public.games add column if not exists visibility text not null default 'invite_only';
alter table public.games add column if not exists allow_matchmaking boolean not null default false;
alter table public.games add column if not exists lobby_kind text not null default 'custom';
alter table public.games add column if not exists matchmaking_target integer not null default 10;
alter table public.games add column if not exists cycle_no integer not null default 1;

alter table public.game_players add column if not exists xp_awarded integer not null default 0;
alter table public.game_players add column if not exists participation_status text not null default 'active';
alter table public.game_players add column if not exists joined_cycle integer not null default 1;

alter table public.practice_sessions add column if not exists library_session_id uuid;
alter table public.practice_sessions add column if not exists origin_library_session_id uuid;

-- Normalize values before restoring checks.
update public.questions set media_review_status='unreviewed'
 where media_review_status is null or media_review_status not in ('unreviewed','auto','approved','rejected','none');
update public.games set visibility='invite_only' where visibility is null or visibility not in ('public','invite_only');
update public.games set lobby_kind='custom' where lobby_kind is null or lobby_kind not in ('custom','matchmaking');
update public.games set matchmaking_target=greatest(2,least(50,coalesce(matchmaking_target,10)));
update public.games set cycle_no=greatest(1,coalesce(cycle_no,1));
update public.game_players set participation_status='active' where participation_status is null or participation_status not in ('active','spectator');
update public.game_players set joined_cycle=greatest(1,coalesce(joined_cycle,1));

-- ---------------------------------------------------------------------------
-- 2. Missing foreign keys / checks from historical upgrades.
--    NOT VALID avoids blocking repair because of old orphan rows; new writes
--    are still protected. Existing data can be validated later.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profiles_ui_theme_check') then
    alter table public.profiles add constraint profiles_ui_theme_check check (ui_theme in ('v1','v2')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.questions'::regclass and conname='questions_media_review_status_check') then
    alter table public.questions add constraint questions_media_review_status_check check (media_review_status in ('unreviewed','auto','approved','rejected','none')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.questions'::regclass and conname='questions_media_candidate_fk') then
    alter table public.questions add constraint questions_media_candidate_fk foreign key (media_candidate_id) references public.question_media_candidates(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.questions'::regclass and conname='questions_deleted_by_fk') then
    alter table public.questions add constraint questions_deleted_by_fk foreign key (deleted_by) references auth.users(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.games'::regclass and conname='games_library_session_fk') then
    alter table public.games add constraint games_library_session_fk foreign key (library_session_id) references public.library_sessions(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.practice_sessions'::regclass and conname='practice_sessions_library_session_fk') then
    alter table public.practice_sessions add constraint practice_sessions_library_session_fk foreign key (library_session_id) references public.library_sessions(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.practice_sessions'::regclass and conname='practice_sessions_origin_library_session_fk') then
    alter table public.practice_sessions add constraint practice_sessions_origin_library_session_fk foreign key (origin_library_session_id) references public.library_sessions(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.games'::regclass and conname='games_visibility_check') then
    alter table public.games add constraint games_visibility_check check (visibility in ('public','invite_only')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.games'::regclass and conname='games_lobby_kind_check') then
    alter table public.games add constraint games_lobby_kind_check check (lobby_kind in ('custom','matchmaking')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.games'::regclass and conname='games_matchmaking_target_check') then
    alter table public.games add constraint games_matchmaking_target_check check (matchmaking_target between 2 and 50) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.game_players'::regclass and conname='game_players_participation_status_check') then
    alter table public.game_players add constraint game_players_participation_status_check check (participation_status in ('active','spectator')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.question_votes'::regclass and conname='question_votes_vote_check') then
    alter table public.question_votes add constraint question_votes_vote_check check (vote in (-1,1)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.game_bots'::regclass and conname='game_bots_skill_check') then
    alter table public.game_bots add constraint game_bots_skill_check check (skill between 0 and 1) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.questions'::regclass and conname='question_answer_shape') then
    alter table public.questions add constraint question_answer_shape check (
      (question_type='numeric' and answer_numeric is not null) or
      (question_type='multiple_choice' and options is not null and correct_option is not null) or
      (question_type='text' and answer_text is not null)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.question_answer_stats'::regclass and conname='question_answer_stats_histogram_len') then
    alter table public.question_answer_stats add constraint question_answer_stats_histogram_len check (array_length(histogram,1)=41) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.library_sessions'::regclass and conname='library_sessions_source_kind_check') then
    alter table public.library_sessions add constraint library_sessions_source_kind_check check (source_kind in ('practice','party','curated','imported')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.library_sessions'::regclass and conname='library_session_question_count') then
    alter table public.library_sessions add constraint library_session_question_count check (cardinality(question_ids)=question_count) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.question_media_candidates'::regclass and conname='question_media_candidate_status_check') then
    alter table public.question_media_candidates add constraint question_media_candidate_status_check check (status in ('candidate','auto_selected','selected','approved','rejected')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.question_audit_log'::regclass and conname='question_audit_log_action_check') then
    alter table public.question_audit_log add constraint question_audit_log_action_check check (action in ('create','edit','delete','restore')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.game_answers'::regclass and conname='game_answers_score_check') then
    alter table public.game_answers add constraint game_answers_score_check check (score between 0 and 1000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.daily_attempts'::regclass and conname='daily_attempts_score_check') then
    alter table public.daily_attempts add constraint daily_attempts_score_check check (score between 0 and 1000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.practice_answers'::regclass and conname='practice_answers_score_check') then
    alter table public.practice_answers add constraint practice_answers_score_check check (score between 0 and 1000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.game_bot_answers'::regclass and conname='game_bot_answers_score_check') then
    alter table public.game_bot_answers add constraint game_bot_answers_score_check check (score between 0 and 1000) not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Required unique/index invariants from all historical versions.
-- ---------------------------------------------------------------------------
create index if not exists games_code_idx on public.games(code);
create index if not exists game_players_game_score_idx on public.game_players(game_id,total_score desc);
create index if not exists game_players_user_game_idx on public.game_players(user_id,game_id);
create index if not exists game_answers_round_idx on public.game_answers(game_id,ordinal,score desc);
create index if not exists questions_filter_idx on public.questions(is_active,category,difficulty);
create unique index if not exists daily_attempts_one_per_user_day on public.daily_attempts(day,user_id);
create index if not exists practice_sessions_user_created_idx on public.practice_sessions(user_id,created_at desc);

-- Replace any old partial canonical-key index with the normal unique index
-- required by PostgREST on_conflict=canonical_key.
drop index if exists public.questions_canonical_key_unique;
create unique index questions_canonical_key_unique on public.questions(canonical_key);
create index if not exists questions_source_entity_idx on public.questions(source_type,source_entity_id) where source_entity_id is not null;
create index if not exists questions_active_updated_idx on public.questions(is_active,updated_at desc);

create index if not exists library_sessions_created_idx on public.library_sessions(created_at desc);
create index if not exists library_sessions_popular_idx on public.library_sessions(play_count desc,created_at desc);
create index if not exists library_sessions_categories_gin on public.library_sessions using gin(categories);
create index if not exists question_media_candidates_question_idx on public.question_media_candidates(question_id,status,score desc);
create index if not exists question_media_candidates_provider_idx on public.question_media_candidates(provider,updated_at desc);
create index if not exists question_votes_question_idx on public.question_votes(question_id,vote);
create index if not exists question_audit_question_idx on public.question_audit_log(question_id,created_at desc);
create index if not exists question_audit_action_idx on public.question_audit_log(action,created_at desc);
create index if not exists games_matchmaking_v14_idx on public.games(visibility,allow_matchmaking,status,lobby_kind,created_at desc);
create index if not exists game_bots_game_score_idx on public.game_bots(game_id,total_score desc);
create index if not exists game_bot_answers_round_idx on public.game_bot_answers(game_id,ordinal,score desc);

-- ---------------------------------------------------------------------------
-- 4. RLS and raw-table privileges expected by the application.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.game_questions enable row level security;
alter table public.game_answers enable row level security;
alter table public.daily_attempts enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.practice_questions enable row level security;
alter table public.practice_answers enable row level security;
alter table public.question_answer_stats enable row level security;
alter table public.library_sessions enable row level security;
alter table public.question_media_candidates enable row level security;
alter table public.question_votes enable row level security;
alter table public.question_audit_log enable row level security;
alter table public.game_bots enable row level security;
alter table public.game_bot_answers enable row level security;

revoke all on public.questions,public.game_questions,public.game_answers,public.daily_attempts,
  public.practice_sessions,public.practice_questions,public.practice_answers,
  public.question_answer_stats,public.library_sessions,public.question_media_candidates,
  public.question_votes,public.question_audit_log,public.game_bots,public.game_bot_answers
from anon,authenticated;

grant select on public.profiles to anon,authenticated;
grant select on public.games,public.game_players to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Realtime prerequisites for persistent multiplayer rooms.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='games') then
      alter publication supabase_realtime add table public.games;
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='game_players') then
      alter publication supabase_realtime add table public.game_players;
    end if;
  end if;
end $$;

alter table public.games replica identity full;
alter table public.game_players replica identity full;

-- ============================================================================
-- The cumulative runtime migrations are appended below. They use CREATE OR
-- REPLACE / IF NOT EXISTS and restore every current V1-V13 RPC, trigger and
-- policy without clearing user/game/question data.
-- ============================================================================
-- WhatMod Trivia - production schema
-- Run this once in the Supabase SQL editor on a new project.
-- This migration keeps correct answers out of normal client SELECT access.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 2 and 24),
  username_customized boolean not null default false,
  avatar_url text,
  xp bigint not null default 0 check (xp >= 0),
  wins integer not null default 0 check (wins >= 0),
  games_played integer not null default 0 check (games_played >= 0),
  daily_streak integer not null default 0 check (daily_streak >= 0),
  last_daily_date date,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Makes this migration safe to re-run over an earlier partial install.
alter table public.profiles add column if not exists username_customized boolean not null default false;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  question_type text not null check (question_type in ('numeric','multiple_choice','text')),
  prompt text not null,
  context text,
  unit text,
  options jsonb,
  answer_numeric numeric,
  answer_text text,
  correct_option integer,
  explanation text,
  source_url text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint question_answer_shape check (
    (question_type='numeric' and answer_numeric is not null) or
    (question_type='multiple_choice' and options is not null and correct_option is not null) or
    (question_type='text' and answer_text is not null)
  )
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code)=6),
  host_id uuid not null references auth.users(id) on delete cascade,
  title text,
  category text not null default 'Any',
  difficulty text not null default 'any',
  question_count integer not null check (question_count between 1 and 50),
  max_players integer not null check (max_players between 2 and 20000),
  game_mode text not null default 'standard' check (game_mode in ('standard','event')),
  seconds_per_question integer not null default 20 check (seconds_per_question between 5 and 120),
  status text not null default 'lobby' check (status in ('lobby','question','results','finished','cancelled')),
  current_question_index integer not null default 0,
  question_started_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.game_players (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  total_score integer not null default 0,
  is_connected boolean not null default true,
  primary key (game_id,user_id)
);

create table if not exists public.game_questions (
  game_id uuid not null references public.games(id) on delete cascade,
  ordinal integer not null,
  question_id uuid not null references public.questions(id),
  primary key (game_id,ordinal)
);

create table if not exists public.game_answers (
  game_id uuid not null references public.games(id) on delete cascade,
  ordinal integer not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer_value text not null,
  answer_numeric numeric,
  score integer not null default 0 check (score between 0 and 1000),
  response_ms integer not null default 0,
  submitted_at timestamptz not null default now(),
  primary key (game_id,ordinal,user_id)
);

create table if not exists public.daily_attempts (
  day date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  answer_value text not null,
  answer_numeric numeric,
  score integer not null check (score between 0 and 1000),
  xp_awarded integer not null,
  submitted_at timestamptz not null default now(),
  primary key (day,user_id)
);

create index if not exists games_code_idx on public.games(code);
create index if not exists game_players_game_score_idx on public.game_players(game_id,total_score desc);
create index if not exists game_answers_round_idx on public.game_answers(game_id,ordinal,score desc);
create index if not exists questions_filter_idx on public.questions(is_active,category,difficulty);

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.game_questions enable row level security;
alter table public.game_answers enable row level security;
alter table public.daily_attempts enable row level security;

-- Profiles are public leaderboard data; sensitive profile fields should never be added here.
drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read" on public.profiles for select using (true);

-- Logged-in participants can read the game shell and participant rows. Correct-answer
-- tables remain inaccessible directly; RPCs below expose only phase-appropriate fields.
drop policy if exists "games participant read" on public.games;
create policy "games participant read" on public.games for select to authenticated
using (host_id=auth.uid() or exists(select 1 from public.game_players p where p.game_id=id and p.user_id=auth.uid()));

drop policy if exists "players participant read" on public.game_players;
create policy "players participant read" on public.game_players for select to authenticated
using (exists(select 1 from public.game_players me where me.game_id=game_players.game_id and me.user_id=auth.uid()));

revoke all on public.questions from anon, authenticated;
revoke all on public.game_questions from anon, authenticated;
revoke all on public.game_answers from anon, authenticated;
revoke all on public.daily_attempts from anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant select on public.games, public.game_players to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  google_name text;
  google_avatar text;
begin
  google_name := left(coalesce(
    nullif(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'name',''),
    nullif(new.raw_user_meta_data->>'given_name',''),
    nullif(split_part(coalesce(new.email,''),'@',1),''),
    'Player'
  ),24);
  google_avatar := coalesce(
    nullif(new.raw_user_meta_data->>'avatar_url',''),
    nullif(new.raw_user_meta_data->>'picture','')
  );

  insert into public.profiles(user_id,username,username_customized,avatar_url)
  values(new.id,google_name,false,google_avatar)
  on conflict(user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.numeric_score(p_guess numeric,p_answer numeric)
returns integer language plpgsql immutable as $$
declare err numeric; result numeric;
begin
  if p_guess is null or p_answer is null then return 0; end if;
  if p_guess=p_answer then return 1000; end if;
  if p_guess>0 and p_answer>0 then
    err:=abs(log(10,p_guess/p_answer));
    result:=1000*exp(-1.35*err);
  else
    err:=abs(p_guess-p_answer)/greatest(1,abs(p_answer));
    result:=1000*exp(-1.65*err);
  end if;
  return greatest(0,least(1000,round(result)::integer));
end $$;

create or replace function public.score_answer(q public.questions,p_answer text)
returns integer language plpgsql immutable as $$
declare g numeric;
begin
  if q.question_type='numeric' then
    begin g:=p_answer::numeric; exception when others then return 0; end;
    return public.numeric_score(g,q.answer_numeric);
  elsif q.question_type='multiple_choice' then
    return case when p_answer=q.correct_option::text then 1000 else 0 end;
  else
    return case when lower(trim(regexp_replace(p_answer,'[^[:alnum:]]+',' ','g')))=lower(trim(regexp_replace(q.answer_text,'[^[:alnum:]]+',' ','g'))) then 1000 else 0 end;
  end if;
end $$;

create or replace function public.make_code()
returns text language plpgsql volatile as $$
declare alphabet text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; out text:=''; i int;
begin
  for i in 1..6 loop out:=out||substr(alphabet,1+floor(random()*length(alphabet))::int,1); end loop;
  return out;
end $$;

create or replace function public.sync_my_google_profile()
returns public.profiles language plpgsql security definer set search_path=public as $$
declare
  p public.profiles;
  u auth.users;
  google_name text;
  google_avatar text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into u from auth.users where id=auth.uid();
  if u.id is null then raise exception 'User not found'; end if;

  google_name := left(coalesce(
    nullif(u.raw_user_meta_data->>'full_name',''),
    nullif(u.raw_user_meta_data->>'name',''),
    nullif(u.raw_user_meta_data->>'given_name',''),
    nullif(split_part(coalesce(u.email,''),'@',1),''),
    'Player'
  ),24);
  google_avatar := coalesce(
    nullif(u.raw_user_meta_data->>'avatar_url',''),
    nullif(u.raw_user_meta_data->>'picture','')
  );

  insert into profiles(user_id,username,username_customized,avatar_url)
  values(u.id,google_name,false,google_avatar)
  on conflict(user_id) do update set
    username = case when profiles.username_customized then profiles.username else excluded.username end,
    avatar_url = coalesce(excluded.avatar_url,profiles.avatar_url)
  returning * into p;
  return p;
end $$;

create or replace function public.update_my_profile(p_username text)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare p public.profiles;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  p_username:=trim(p_username);
  if char_length(p_username)<2 or char_length(p_username)>24 then raise exception 'Display name must be 2-24 characters'; end if;
  update profiles set username=p_username,username_customized=true where user_id=auth.uid() returning * into p;
  return p;
end $$;

create or replace function public.create_lobby(
  p_category text default 'Any', p_difficulty text default 'any', p_question_count int default 10,
  p_max_players int default 10, p_game_mode text default 'standard', p_seconds_per_question int default 20,
  p_title text default null
) returns setof public.games language plpgsql security definer set search_path=public as $$
declare g public.games; c text; tries int:=0;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_max_players<2 or p_max_players>20000 then raise exception 'Invalid player limit'; end if;
  if p_game_mode not in ('standard','event') then raise exception 'Invalid game mode'; end if;
  loop
    c:=make_code(); tries:=tries+1;
    exit when not exists(select 1 from games where code=c);
    if tries>20 then raise exception 'Could not allocate lobby code'; end if;
  end loop;
  insert into games(code,host_id,title,category,difficulty,question_count,max_players,game_mode,seconds_per_question)
  values(c,auth.uid(),nullif(trim(p_title),''),coalesce(p_category,'Any'),coalesce(p_difficulty,'any'),
         greatest(1,least(50,p_question_count)),p_max_players,p_game_mode,greatest(5,least(120,p_seconds_per_question)))
  returning * into g;
  insert into game_players(game_id,user_id) values(g.id,auth.uid());
  return next g;
end $$;

create or replace function public.join_lobby(p_code text)
returns setof public.games language plpgsql security definer set search_path=public as $$
declare g games; n int;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into g from games where code=upper(trim(p_code)) for update;
  if g.id is null then raise exception 'Lobby not found'; end if;
  if g.status<>'lobby' then raise exception 'This game has already started'; end if;
  select count(*) into n from game_players where game_id=g.id;
  if n>=g.max_players and not exists(select 1 from game_players where game_id=g.id and user_id=auth.uid()) then raise exception 'Lobby is full'; end if;
  insert into game_players(game_id,user_id) values(g.id,auth.uid()) on conflict do nothing;
  return next g;
end $$;

create or replace function public.get_lobby(p_code text)
returns table(id uuid,code text,host_id uuid,title text,category text,difficulty text,question_count int,max_players int,game_mode text,seconds_per_question int,status text,current_question_index int,question_started_at timestamptz,player_count bigint)
language sql security definer set search_path=public as $$
  select g.id,g.code,g.host_id,g.title,g.category,g.difficulty,g.question_count,g.max_players,g.game_mode,g.seconds_per_question,g.status,g.current_question_index,g.question_started_at,
  (select count(*) from game_players p where p.game_id=g.id)
  from games g where g.code=upper(trim(p_code))
  and (g.status='lobby' or g.host_id=auth.uid() or exists(select 1 from game_players p where p.game_id=g.id and p.user_id=auth.uid()));
$$;

create or replace function public.get_lobby_players(p_game_id uuid)
returns table(user_id uuid,username text,avatar_url text,total_score int)
language sql security definer set search_path=public as $$
  select p.user_id,pr.username,pr.avatar_url,p.total_score from game_players p join profiles pr using(user_id)
  where p.game_id=p_game_id and (exists(select 1 from game_players me where me.game_id=p_game_id and me.user_id=auth.uid()) or exists(select 1 from games g where g.id=p_game_id and g.status='lobby'))
  order by p.total_score desc,p.joined_at asc;
$$;

create or replace function public.start_lobby(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare g games; available int;
begin
  select * into g from games where id=p_game_id for update;
  if g.host_id<>auth.uid() then raise exception 'Host only'; end if;
  if g.status<>'lobby' then raise exception 'Game already started'; end if;

  select count(*) into available from questions q where q.is_active
    and (g.category='Any' or q.category=g.category)
    and (g.difficulty='any' or q.difficulty=g.difficulty);
  if available<g.question_count then raise exception 'Not enough matching questions in the bank (% available)',available; end if;

  insert into game_questions(game_id,ordinal,question_id)
  select g.id,row_number() over()-1,id from (
    select id from questions q where q.is_active and (g.category='Any' or q.category=g.category)
      and (g.difficulty='any' or q.difficulty=g.difficulty) order by random() limit g.question_count
  ) picked;
  update games set status='question',current_question_index=0,question_started_at=now() where id=g.id;
end $$;

create or replace function public.get_current_question(p_game_id uuid)
returns table(id uuid,ordinal int,category text,difficulty text,question_type text,prompt text,context text,unit text,options jsonb,answer_numeric numeric,answer_text text,answer_display text,explanation text)
language plpgsql security definer set search_path=public as $$
declare g games;
begin
  select g0.* into g from games g0 where g0.id=p_game_id;
  if not exists(select 1 from game_players where game_id=p_game_id and user_id=auth.uid()) then raise exception 'Not in game'; end if;
  return query
    select q.id,g.current_question_index,q.category,q.difficulty,q.question_type,q.prompt,q.context,q.unit,q.options,
      case when g.status in('results','finished') then q.answer_numeric else null end,
      case when g.status in('results','finished') then q.answer_text else null end,
      case when g.status in('results','finished') and q.question_type='multiple_choice' then q.options->>q.correct_option else null end,
      case when g.status in('results','finished') then q.explanation else null end
    from game_questions gq join questions q on q.id=gq.question_id
    where gq.game_id=p_game_id and gq.ordinal=g.current_question_index;
end $$;

create or replace function public.submit_game_answer(p_game_id uuid,p_answer text,p_response_ms int default 0)
returns table(score int,total_score int) language plpgsql security definer set search_path=public as $$
declare g games; q questions; s int; numeric_answer numeric;
begin
  select * into g from games where id=p_game_id for update;
  if g.status<>'question' then raise exception 'Answers are closed'; end if;
  if not exists(select 1 from game_players where game_id=p_game_id and user_id=auth.uid()) then raise exception 'Not in game'; end if;
  if now()>g.question_started_at + make_interval(secs=>g.seconds_per_question+5) then raise exception 'Time expired'; end if;
  select qu.* into q from game_questions gq join questions qu on qu.id=gq.question_id where gq.game_id=g.id and gq.ordinal=g.current_question_index;
  s:=score_answer(q,p_answer);
  if q.question_type='numeric' then begin numeric_answer:=p_answer::numeric; exception when others then numeric_answer:=null; end; end if;
  insert into game_answers(game_id,ordinal,user_id,answer_value,answer_numeric,score,response_ms)
    values(g.id,g.current_question_index,auth.uid(),left(p_answer,200),numeric_answer,s,greatest(0,p_response_ms))
    on conflict do nothing;
  if found then update game_players set total_score=game_players.total_score+s where game_id=g.id and user_id=auth.uid(); end if;
  return query select s,p.total_score from game_players p where p.game_id=g.id and p.user_id=auth.uid();
end $$;

create or replace function public.reveal_round(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update games set status='results' where id=p_game_id and host_id=auth.uid() and status='question';
  if not found then raise exception 'Host only or wrong game phase'; end if;
end $$;

create or replace function public.next_round(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare g games;
begin
  select * into g from games where id=p_game_id for update;
  if g.host_id<>auth.uid() then raise exception 'Host only'; end if;
  if g.status<>'results' then raise exception 'Reveal the current round first'; end if;
  if g.current_question_index+1>=g.question_count then
    update games set status='finished',finished_at=now() where id=g.id;
    update profiles pr set games_played=pr.games_played+1,
      wins=pr.wins + case when pr.user_id=(select p.user_id from game_players p where p.game_id=g.id order by p.total_score desc,p.joined_at asc limit 1) then 1 else 0 end,
      xp=pr.xp + coalesce((select greatest(10,round(p.total_score::numeric/g.question_count/20)::int) from game_players p where p.game_id=g.id and p.user_id=pr.user_id),0)
    where exists(select 1 from game_players p where p.game_id=g.id and p.user_id=pr.user_id);
  else
    update games set current_question_index=current_question_index+1,status='question',question_started_at=now() where id=g.id;
  end if;
end $$;

create or replace function public.get_round_results(p_game_id uuid)
returns table(user_id uuid,username text,avatar_url text,answer_numeric numeric,answer_value text,score int,total_score int,is_me boolean)
language sql security definer set search_path=public as $$
  select p.user_id,pr.username,pr.avatar_url,a.answer_numeric,a.answer_value,coalesce(a.score,0),p.total_score,(p.user_id=auth.uid())
  from games g join game_players p on p.game_id=g.id join profiles pr on pr.user_id=p.user_id
  left join game_answers a on a.game_id=g.id and a.ordinal=g.current_question_index and a.user_id=p.user_id
  where g.id=p_game_id and g.status in('results','finished')
    and exists(select 1 from game_players me where me.game_id=g.id and me.user_id=auth.uid())
  order by p.total_score desc,a.score desc nulls last;
$$;

create or replace function public.daily_question_id(p_day date)
returns uuid language sql stable security definer set search_path=public as $$
  select id from questions where is_active and question_type='numeric'
  -- md5(text) is built into PostgreSQL, so this deterministic daily shuffle has no extension dependency.
  order by md5(id::text || ':' || p_day::text) limit 1;
$$;

create or replace function public.get_daily_question()
returns table(id uuid,daily_number bigint,category text,difficulty text,question_type text,prompt text,context text,unit text,options jsonb,already_played boolean)
language sql security definer set search_path=public as $$
  select q.id,(current_date-date '2026-01-01')::bigint+1,q.category,q.difficulty,q.question_type,q.prompt,q.context,q.unit,q.options,
  exists(select 1 from daily_attempts d where d.day=current_date and d.user_id=auth.uid())
  from questions q where q.id=daily_question_id(current_date);
$$;

create or replace function public.submit_daily_answer(p_answer text)
returns table(score int,xp_awarded int,your_answer numeric,answer_numeric numeric,explanation text,guesses numeric[])
language plpgsql security definer set search_path=public as $$
declare q questions; s int; xp int; guess numeric; prev date; streak int;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into q from questions where id=daily_question_id(current_date);
  if q.id is null then raise exception 'No daily question configured'; end if;
  begin guess:=p_answer::numeric; exception when others then raise exception 'Numeric answer required'; end;
  s:=score_answer(q,p_answer); xp:=greatest(5,round(s::numeric/20)::int+15);
  insert into daily_attempts(day,user_id,question_id,answer_value,answer_numeric,score,xp_awarded)
    values(current_date,auth.uid(),q.id,left(p_answer,200),guess,s,xp)
    on conflict(day,user_id) do nothing;
  if not found then raise exception 'You already played today'; end if;
  select last_daily_date,daily_streak into prev,streak from profiles where user_id=auth.uid() for update;
  update profiles set xp=profiles.xp+xp,
    daily_streak=case when prev=current_date-1 then streak+1 else 1 end,
    last_daily_date=current_date where user_id=auth.uid();
  return query select s,xp,guess,q.answer_numeric,q.explanation,
    coalesce((select array_agg(d.answer_numeric) from daily_attempts d where d.day=current_date and d.answer_numeric is not null),array[]::numeric[]);
end $$;

-- Minimal admin RPC. Make yourself admin once by updating profiles.is_admin in SQL.
create or replace function public.admin_add_question(
  p_category text,p_difficulty text,p_question_type text,p_prompt text,p_context text default null,p_unit text default null,
  p_options jsonb default null,p_answer_numeric numeric default null,p_answer_text text default null,p_correct_option int default null,
  p_explanation text default null,p_source_url text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare qid uuid;
begin
  if not exists(select 1 from profiles where user_id=auth.uid() and is_admin) then raise exception 'Admin only'; end if;
  insert into questions(category,difficulty,question_type,prompt,context,unit,options,answer_numeric,answer_text,correct_option,explanation,source_url,created_by)
  values(p_category,p_difficulty,p_question_type,p_prompt,p_context,p_unit,p_options,p_answer_numeric,p_answer_text,p_correct_option,p_explanation,p_source_url,auth.uid())
  returning id into qid;
  return qid;
end $$;

grant execute on function public.sync_my_google_profile() to authenticated;
grant execute on function public.update_my_profile(text) to authenticated;
grant execute on function public.create_lobby(text,text,int,int,text,int,text) to authenticated;
grant execute on function public.join_lobby(text) to authenticated;
grant execute on function public.get_lobby(text) to anon,authenticated;
grant execute on function public.get_lobby_players(uuid) to authenticated;
grant execute on function public.start_lobby(uuid) to authenticated;
grant execute on function public.get_current_question(uuid) to authenticated;
grant execute on function public.submit_game_answer(uuid,text,int) to authenticated;
grant execute on function public.reveal_round(uuid) to authenticated;
grant execute on function public.next_round(uuid) to authenticated;
grant execute on function public.get_round_results(uuid) to authenticated;
grant execute on function public.get_daily_question() to authenticated;
grant execute on function public.submit_daily_answer(text) to authenticated;
grant execute on function public.admin_add_question(text,text,text,text,text,text,jsonb,numeric,text,int,text,text) to authenticated;

-- Realtime only needs the two lightweight state tables.
do $$ begin
  alter publication supabase_realtime add table public.games;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.game_players;
exception when duplicate_object then null; end $$;

-- ============================================================
-- V3 Daily lock + Practice mode (included for fresh installs)
-- ============================================================
-- WhatMod Trivia V3
-- 1) hard-lock Daily Quest to one credited attempt per user per database day
-- 2) add unlimited zero-XP Practice sessions
-- Safe upgrade for an existing V1/V2 project.

-- The table already has a primary key (day,user_id) in the original schema,
-- but keep an explicit unique index as a defensive invariant for upgraded projects.
create unique index if not exists daily_attempts_one_per_user_day
  on public.daily_attempts(day,user_id);

-- Rich Daily state. Before the user plays, answer fields are NULL.
-- After the one allowed attempt, reopening Daily returns the saved result rather
-- than another playable input.
create or replace function public.get_daily_state()
returns table(
  id uuid,
  daily_number bigint,
  category text,
  difficulty text,
  question_type text,
  prompt text,
  context text,
  unit text,
  options jsonb,
  already_played boolean,
  score int,
  xp_awarded int,
  your_answer numeric,
  answer_numeric numeric,
  answer_text text,
  answer_display text,
  explanation text,
  guesses numeric[]
)
language sql security definer set search_path=public as $$
  with mine as (
    select d.*
    from daily_attempts d
    where d.day=current_date and d.user_id=auth.uid()
    limit 1
  ),
  chosen as (
    select coalesce((select question_id from mine),daily_question_id(current_date)) as question_id
  )
  select
    q.id,
    (current_date-date '2026-01-01')::bigint+1,
    q.category,
    q.difficulty,
    q.question_type,
    q.prompt,
    q.context,
    q.unit,
    q.options,
    exists(select 1 from mine) as already_played,
    d.score,
    d.xp_awarded,
    d.answer_numeric,
    case when d.user_id is not null then q.answer_numeric else null end,
    case when d.user_id is not null then q.answer_text else null end,
    case when d.user_id is not null and q.question_type='multiple_choice' then q.options->>q.correct_option else null end,
    case when d.user_id is not null then q.explanation else null end,
    case when d.user_id is not null then
      coalesce((select array_agg(x.answer_numeric) from daily_attempts x where x.day=current_date and x.answer_numeric is not null),array[]::numeric[])
    else array[]::numeric[] end
  from chosen c
  join questions q on q.id=c.question_id
  left join mine d on true;
$$;

-- Replace the Daily submission function with a serialized, race-safe version.
-- Locking the player's profile row prevents two simultaneous requests from both
-- reaching the XP update. The unique key remains the final database guard.
create or replace function public.submit_daily_answer(p_answer text)
returns table(score int,xp_awarded int,your_answer numeric,answer_numeric numeric,explanation text,guesses numeric[])
language plpgsql security definer set search_path=public as $$
declare
  q questions;
  s int;
  award int;
  guess numeric;
  prev date;
  streak int;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;

  -- Serialize Daily submissions for this user.
  select p.last_daily_date,p.daily_streak
    into prev,streak
  from profiles p
  where p.user_id=auth.uid()
  for update;

  if not found then raise exception 'Profile not found'; end if;

  if exists(select 1 from daily_attempts d where d.day=current_date and d.user_id=auth.uid()) then
    raise exception 'Today''s Daily Quest is already complete';
  end if;

  select * into q from questions where id=daily_question_id(current_date);
  if q.id is null then raise exception 'No daily question configured'; end if;

  begin
    guess:=p_answer::numeric;
  exception when others then
    raise exception 'Numeric answer required';
  end;

  s:=score_answer(q,p_answer);
  award:=greatest(5,round(s::numeric/20)::int+15);

  insert into daily_attempts(day,user_id,question_id,answer_value,answer_numeric,score,xp_awarded)
  values(current_date,auth.uid(),q.id,left(p_answer,200),guess,s,award);

  update profiles
  set xp=profiles.xp+award,
      daily_streak=case when prev=current_date-1 then coalesce(streak,0)+1 else 1 end,
      last_daily_date=current_date
  where user_id=auth.uid();

  return query
    select s,award,guess,q.answer_numeric,q.explanation,
      coalesce((select array_agg(d.answer_numeric) from daily_attempts d where d.day=current_date and d.answer_numeric is not null),array[]::numeric[]);
end $$;

grant execute on function public.get_daily_state() to authenticated;
grant execute on function public.submit_daily_answer(text) to authenticated;

-- ---------------------------
-- Practice mode
-- ---------------------------
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  categories text[] not null default array[]::text[],
  difficulty text not null default 'any',
  question_count integer not null check(question_count between 1 and 25),
  current_index integer not null default 0,
  total_score integer not null default 0 check(total_score >= 0),
  status text not null default 'active' check(status in ('active','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.practice_questions (
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  ordinal integer not null,
  question_id uuid not null references public.questions(id),
  primary key(session_id,ordinal)
);

create table if not exists public.practice_answers (
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  ordinal integer not null,
  answer_value text not null,
  answer_numeric numeric,
  score integer not null check(score between 0 and 1000),
  response_ms integer not null default 0,
  submitted_at timestamptz not null default now(),
  primary key(session_id,ordinal)
);

create index if not exists practice_sessions_user_created_idx on public.practice_sessions(user_id,created_at desc);

alter table public.practice_sessions enable row level security;
alter table public.practice_questions enable row level security;
alter table public.practice_answers enable row level security;

-- Practice data is intentionally RPC-only so correct answers cannot be fetched
-- directly from browser queries before the user submits.
revoke all on public.practice_sessions from anon,authenticated;
revoke all on public.practice_questions from anon,authenticated;
revoke all on public.practice_answers from anon,authenticated;

create or replace function public.start_practice(
  p_categories text[] default array[]::text[],
  p_difficulty text default 'any',
  p_question_count int default 10
)
returns table(session_id uuid,question_count int,current_index int,status text,total_score int)
language plpgsql security definer set search_path=public as $$
declare
  sid uuid;
  requested int;
  available int;
  actual int;
  cats text[];
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;

  requested:=greatest(1,least(25,coalesce(p_question_count,10)));
  cats:=coalesce(p_categories,array[]::text[]);

  if p_difficulty is null or p_difficulty not in ('any','easy','medium','hard') then
    p_difficulty:='any';
  end if;

  select count(*) into available
  from questions q
  where q.is_active
    and (coalesce(cardinality(cats),0)=0 or q.category=any(cats))
    and (p_difficulty='any' or q.difficulty=p_difficulty);

  if available=0 then
    raise exception 'No practice questions match that category/difficulty selection';
  end if;

  actual:=least(requested,available);

  insert into practice_sessions(user_id,categories,difficulty,question_count)
  values(auth.uid(),cats,p_difficulty,actual)
  returning id into sid;

  insert into practice_questions(session_id,ordinal,question_id)
  select sid,row_number() over()-1,q.id
  from (
    select id
    from questions q
    where q.is_active
      and (coalesce(cardinality(cats),0)=0 or q.category=any(cats))
      and (p_difficulty='any' or q.difficulty=p_difficulty)
    order by random()
    limit actual
  ) q;

  return query select sid,actual,0,'active'::text,0;
end $$;

create or replace function public.get_practice_question(p_session_id uuid)
returns table(
  session_id uuid,
  ordinal int,
  question_count int,
  total_score int,
  status text,
  id uuid,
  category text,
  difficulty text,
  question_type text,
  prompt text,
  context text,
  unit text,
  options jsonb,
  answered boolean,
  score int,
  your_answer text,
  answer_numeric numeric,
  answer_text text,
  answer_display text,
  explanation text
)
language plpgsql security definer set search_path=public as $$
declare s practice_sessions;
begin
  select * into s from practice_sessions
  where practice_sessions.id=p_session_id and user_id=auth.uid();

  if s.id is null then raise exception 'Practice session not found'; end if;

  return query
  select
    s.id,
    s.current_index,
    s.question_count,
    s.total_score,
    s.status,
    q.id,
    q.category,
    q.difficulty,
    q.question_type,
    q.prompt,
    q.context,
    q.unit,
    q.options,
    (a.session_id is not null),
    a.score,
    a.answer_value,
    case when a.session_id is not null then q.answer_numeric else null end,
    case when a.session_id is not null then q.answer_text else null end,
    case
      when a.session_id is null then null
      when q.question_type='multiple_choice' then q.options->>q.correct_option
      when q.question_type='text' then q.answer_text
      else q.answer_numeric::text
    end,
    case when a.session_id is not null then q.explanation else null end
  from practice_questions pq
  join questions q on q.id=pq.question_id
  left join practice_answers a on a.session_id=pq.session_id and a.ordinal=pq.ordinal
  where pq.session_id=s.id and pq.ordinal=s.current_index;
end $$;

create or replace function public.submit_practice_answer(
  p_session_id uuid,
  p_answer text,
  p_response_ms int default 0
)
returns table(
  score int,
  your_answer text,
  answer_numeric numeric,
  answer_text text,
  answer_display text,
  explanation text,
  total_score int
)
language plpgsql security definer set search_path=public as $$
declare
  s practice_sessions;
  q questions;
  points int;
  numeric_answer numeric;
  affected int;
  new_total int;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;

  select * into s from practice_sessions
  where id=p_session_id and user_id=auth.uid()
  for update;

  if s.id is null then raise exception 'Practice session not found'; end if;
  if s.status<>'active' then raise exception 'Practice session is already complete'; end if;

  select qu.* into q
  from practice_questions pq
  join questions qu on qu.id=pq.question_id
  where pq.session_id=s.id and pq.ordinal=s.current_index;

  if q.id is null then raise exception 'Practice question not found'; end if;

  points:=score_answer(q,p_answer);
  if q.question_type='numeric' then
    begin numeric_answer:=p_answer::numeric; exception when others then numeric_answer:=null; end;
  end if;

  insert into practice_answers(session_id,ordinal,answer_value,answer_numeric,score,response_ms)
  values(s.id,s.current_index,left(p_answer,200),numeric_answer,points,greatest(0,coalesce(p_response_ms,0)))
  on conflict(session_id,ordinal) do nothing;

  get diagnostics affected = row_count;
  if affected=0 then raise exception 'This practice question was already answered'; end if;

  update practice_sessions
  set total_score=practice_sessions.total_score+points
  where id=s.id
  returning practice_sessions.total_score into new_total;

  return query
  select
    points,
    case when q.question_type='multiple_choice' then coalesce(q.options->>(p_answer::int),p_answer) else p_answer end,
    q.answer_numeric,
    q.answer_text,
    case
      when q.question_type='multiple_choice' then q.options->>q.correct_option
      when q.question_type='text' then q.answer_text
      else q.answer_numeric::text
    end,
    q.explanation,
    new_total;
exception
  when invalid_text_representation then
    raise exception 'Invalid answer';
end $$;

create or replace function public.next_practice_question(p_session_id uuid)
returns table(session_id uuid,question_count int,current_index int,status text,total_score int)
language plpgsql security definer set search_path=public as $$
declare s practice_sessions;
begin
  select * into s from practice_sessions
  where id=p_session_id and user_id=auth.uid()
  for update;

  if s.id is null then raise exception 'Practice session not found'; end if;
  if s.status='completed' then
    return query select s.id,s.question_count,s.current_index,s.status,s.total_score;
    return;
  end if;

  if not exists(
    select 1 from practice_answers a
    where a.session_id=s.id and a.ordinal=s.current_index
  ) then
    raise exception 'Answer the current practice question first';
  end if;

  if s.current_index+1>=s.question_count then
    update practice_sessions
    set status='completed',completed_at=now()
    where id=s.id
    returning * into s;
  else
    update practice_sessions
    set current_index=practice_sessions.current_index+1
    where id=s.id
    returning * into s;
  end if;

  return query select s.id,s.question_count,s.current_index,s.status,s.total_score;
end $$;

create or replace function public.get_practice_summary(p_session_id uuid)
returns table(
  ordinal int,
  prompt text,
  category text,
  unit text,
  score int,
  your_answer text,
  correct_answer text
)
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from practice_sessions s where s.id=p_session_id and s.user_id=auth.uid()) then
    raise exception 'Practice session not found';
  end if;

  return query
  select
    pq.ordinal,
    q.prompt,
    q.category,
    q.unit,
    a.score,
    case when q.question_type='multiple_choice' then coalesce(q.options->>(a.answer_value::int),a.answer_value) else a.answer_value end,
    case
      when q.question_type='multiple_choice' then q.options->>q.correct_option
      when q.question_type='text' then q.answer_text
      else q.answer_numeric::text
    end
  from practice_questions pq
  join questions q on q.id=pq.question_id
  join practice_answers a on a.session_id=pq.session_id and a.ordinal=pq.ordinal
  where pq.session_id=p_session_id
  order by pq.ordinal;
exception
  when invalid_text_representation then
    raise exception 'Practice summary contains an invalid stored choice';
end $$;

grant execute on function public.start_practice(text[],text,int) to authenticated;
grant execute on function public.get_practice_question(uuid) to authenticated;
grant execute on function public.submit_practice_answer(uuid,text,int) to authenticated;
grant execute on function public.next_practice_question(uuid) to authenticated;
grant execute on function public.get_practice_summary(uuid) to authenticated;


-- ============================================================
-- V4 production hardening (included for fresh installs)
-- ============================================================
-- WhatMod Trivia V4 - Production hardening
-- Fixes ambiguous PL/pgSQL output-column references and hardens round/practice RPCs.
-- Safe to run on an existing V3 project. Does not reset or delete user/game data.

-- -----------------------------------------------------------------------------
-- Multiplayer: fully qualify game/player columns so RETURNS TABLE output names
-- can never collide with SQL column references.
-- -----------------------------------------------------------------------------
create or replace function public.get_current_question(p_game_id uuid)
returns table(
  id uuid,
  ordinal int,
  category text,
  difficulty text,
  question_type text,
  prompt text,
  context text,
  unit text,
  options jsonb,
  answer_numeric numeric,
  answer_text text,
  answer_display text,
  explanation text
)
language plpgsql security definer set search_path=public as $$
declare
  g_rec public.games;
begin
  select g0.* into g_rec
  from public.games g0
  where g0.id=p_game_id;

  if g_rec.id is null then raise exception 'Game not found'; end if;
  if not exists(
    select 1 from public.game_players gp
    where gp.game_id=p_game_id and gp.user_id=auth.uid()
  ) then raise exception 'Not in game'; end if;

  return query
    select
      q.id,
      g_rec.current_question_index,
      q.category,
      q.difficulty,
      q.question_type,
      q.prompt,
      q.context,
      q.unit,
      q.options,
      case when g_rec.status in('results','finished') then q.answer_numeric else null end,
      case when g_rec.status in('results','finished') then q.answer_text else null end,
      case when g_rec.status in('results','finished') and q.question_type='multiple_choice' then q.options->>q.correct_option else null end,
      case when g_rec.status in('results','finished') then q.explanation else null end
    from public.game_questions gq
    join public.questions q on q.id=gq.question_id
    where gq.game_id=p_game_id and gq.ordinal=g_rec.current_question_index;
end $$;

create or replace function public.submit_game_answer(
  p_game_id uuid,
  p_answer text,
  p_response_ms int default 0
)
returns table(score int,total_score int)
language plpgsql security definer set search_path=public as $$
declare
  g_rec public.games;
  q_rec public.questions;
  p_points int;
  p_numeric_answer numeric;
  p_inserted int;
  p_total int;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;

  select g0.* into g_rec
  from public.games g0
  where g0.id=p_game_id
  for update;

  if g_rec.id is null then raise exception 'Game not found'; end if;
  if g_rec.status<>'question' then raise exception 'Answers are closed'; end if;
  if not exists(
    select 1 from public.game_players gp
    where gp.game_id=p_game_id and gp.user_id=auth.uid()
  ) then raise exception 'Not in game'; end if;
  if g_rec.question_started_at is null then raise exception 'Question has not started'; end if;
  if now()>g_rec.question_started_at + make_interval(secs=>g_rec.seconds_per_question+5) then
    raise exception 'Time expired';
  end if;

  select q.* into q_rec
  from public.game_questions gq
  join public.questions q on q.id=gq.question_id
  where gq.game_id=g_rec.id and gq.ordinal=g_rec.current_question_index;

  if q_rec.id is null then raise exception 'Question not found'; end if;

  p_points:=public.score_answer(q_rec,p_answer);
  if q_rec.question_type='numeric' then
    begin p_numeric_answer:=p_answer::numeric;
    exception when others then p_numeric_answer:=null;
    end;
  end if;

  insert into public.game_answers(game_id,ordinal,user_id,answer_value,answer_numeric,score,response_ms)
  values(
    g_rec.id,
    g_rec.current_question_index,
    auth.uid(),
    left(p_answer,200),
    p_numeric_answer,
    p_points,
    greatest(0,coalesce(p_response_ms,0))
  )
  on conflict(game_id,ordinal,user_id) do nothing;

  get diagnostics p_inserted = row_count;

  if p_inserted=1 then
    update public.game_players gp
    set total_score=gp.total_score+p_points
    where gp.game_id=g_rec.id and gp.user_id=auth.uid()
    returning gp.total_score into p_total;
  else
    select gp.total_score into p_total
    from public.game_players gp
    where gp.game_id=g_rec.id and gp.user_id=auth.uid();
  end if;

  return query select p_points,coalesce(p_total,0);
end $$;

create or replace function public.next_round(p_game_id uuid)
returns void
language plpgsql security definer set search_path=public as $$
declare
  g_rec public.games;
  winner_id uuid;
begin
  select g0.* into g_rec
  from public.games g0
  where g0.id=p_game_id
  for update;

  if g_rec.id is null then raise exception 'Game not found'; end if;
  if g_rec.host_id<>auth.uid() then raise exception 'Host only'; end if;
  if g_rec.status<>'results' then raise exception 'Reveal the current round first'; end if;

  if g_rec.current_question_index+1>=g_rec.question_count then
    select gp.user_id into winner_id
    from public.game_players gp
    where gp.game_id=g_rec.id
    order by gp.total_score desc,gp.joined_at asc
    limit 1;

    update public.games g0
    set status='finished',finished_at=now()
    where g0.id=g_rec.id;

    update public.profiles pr
    set games_played=pr.games_played+1,
        wins=pr.wins + case when pr.user_id=winner_id then 1 else 0 end,
        xp=pr.xp + coalesce((
          select greatest(10,round(gp.total_score::numeric/g_rec.question_count/20)::int)
          from public.game_players gp
          where gp.game_id=g_rec.id and gp.user_id=pr.user_id
        ),0)
    where exists(
      select 1 from public.game_players gp
      where gp.game_id=g_rec.id and gp.user_id=pr.user_id
    );
  else
    update public.games g0
    set current_question_index=g0.current_question_index+1,
        status='question',
        question_started_at=now()
    where g0.id=g_rec.id;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Practice: use explicit aliases for every mutable session column. This fixes
-- V3's: column reference "current_index" is ambiguous.
-- -----------------------------------------------------------------------------
create or replace function public.get_practice_question(p_session_id uuid)
returns table(
  session_id uuid,
  ordinal int,
  question_count int,
  total_score int,
  status text,
  id uuid,
  category text,
  difficulty text,
  question_type text,
  prompt text,
  context text,
  unit text,
  options jsonb,
  answered boolean,
  score int,
  your_answer text,
  answer_numeric numeric,
  answer_text text,
  answer_display text,
  explanation text
)
language plpgsql security definer set search_path=public as $$
declare
  s_rec public.practice_sessions;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;

  select ps.* into s_rec
  from public.practice_sessions ps
  where ps.id=p_session_id and ps.user_id=auth.uid();

  if s_rec.id is null then raise exception 'Practice session not found'; end if;

  return query
  select
    s_rec.id,
    s_rec.current_index,
    s_rec.question_count,
    s_rec.total_score,
    s_rec.status,
    q.id,
    q.category,
    q.difficulty,
    q.question_type,
    q.prompt,
    q.context,
    q.unit,
    q.options,
    (pa.session_id is not null),
    pa.score,
    pa.answer_value,
    case when pa.session_id is not null then q.answer_numeric else null end,
    case when pa.session_id is not null then q.answer_text else null end,
    case
      when pa.session_id is null then null
      when q.question_type='multiple_choice' then q.options->>q.correct_option
      when q.question_type='text' then q.answer_text
      else q.answer_numeric::text
    end,
    case when pa.session_id is not null then q.explanation else null end
  from public.practice_questions pq
  join public.questions q on q.id=pq.question_id
  left join public.practice_answers pa on pa.session_id=pq.session_id and pa.ordinal=pq.ordinal
  where pq.session_id=s_rec.id and pq.ordinal=s_rec.current_index;
end $$;

create or replace function public.submit_practice_answer(
  p_session_id uuid,
  p_answer text,
  p_response_ms int default 0
)
returns table(
  score int,
  your_answer text,
  answer_numeric numeric,
  answer_text text,
  answer_display text,
  explanation text,
  total_score int
)
language plpgsql security definer set search_path=public as $$
declare
  s_rec public.practice_sessions;
  q_rec public.questions;
  p_points int;
  p_numeric_answer numeric;
  p_inserted int;
  p_new_total int;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;

  select ps.* into s_rec
  from public.practice_sessions ps
  where ps.id=p_session_id and ps.user_id=auth.uid()
  for update;

  if s_rec.id is null then raise exception 'Practice session not found'; end if;
  if s_rec.status<>'active' then raise exception 'Practice session is already complete'; end if;

  select q.* into q_rec
  from public.practice_questions pq
  join public.questions q on q.id=pq.question_id
  where pq.session_id=s_rec.id and pq.ordinal=s_rec.current_index;

  if q_rec.id is null then raise exception 'Practice question not found'; end if;

  p_points:=public.score_answer(q_rec,p_answer);
  if q_rec.question_type='numeric' then
    begin p_numeric_answer:=p_answer::numeric;
    exception when others then p_numeric_answer:=null;
    end;
  end if;

  insert into public.practice_answers(session_id,ordinal,answer_value,answer_numeric,score,response_ms)
  values(
    s_rec.id,
    s_rec.current_index,
    left(p_answer,200),
    p_numeric_answer,
    p_points,
    greatest(0,coalesce(p_response_ms,0))
  )
  on conflict(session_id,ordinal) do nothing;

  get diagnostics p_inserted = row_count;
  if p_inserted=0 then raise exception 'This practice question was already answered'; end if;

  update public.practice_sessions ps
  set total_score=ps.total_score+p_points
  where ps.id=s_rec.id
  returning ps.total_score into p_new_total;

  return query
  select
    p_points,
    case
      when q_rec.question_type='multiple_choice' then coalesce(q_rec.options->>(p_answer::int),p_answer)
      else p_answer
    end,
    q_rec.answer_numeric,
    q_rec.answer_text,
    case
      when q_rec.question_type='multiple_choice' then q_rec.options->>q_rec.correct_option
      when q_rec.question_type='text' then q_rec.answer_text
      else q_rec.answer_numeric::text
    end,
    q_rec.explanation,
    p_new_total;
exception
  when invalid_text_representation then
    raise exception 'Invalid answer';
end $$;

create or replace function public.next_practice_question(p_session_id uuid)
returns table(session_id uuid,question_count int,current_index int,status text,total_score int)
language plpgsql security definer set search_path=public as $$
declare
  s_rec public.practice_sessions;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;

  select ps.* into s_rec
  from public.practice_sessions ps
  where ps.id=p_session_id and ps.user_id=auth.uid()
  for update;

  if s_rec.id is null then raise exception 'Practice session not found'; end if;

  if s_rec.status='completed' then
    return query select s_rec.id,s_rec.question_count,s_rec.current_index,s_rec.status,s_rec.total_score;
    return;
  end if;

  if not exists(
    select 1 from public.practice_answers pa
    where pa.session_id=s_rec.id and pa.ordinal=s_rec.current_index
  ) then
    raise exception 'Answer the current practice question first';
  end if;

  if s_rec.current_index+1>=s_rec.question_count then
    update public.practice_sessions ps
    set status='completed',completed_at=coalesce(ps.completed_at,now())
    where ps.id=s_rec.id
    returning ps.* into s_rec;
  else
    update public.practice_sessions ps
    set current_index=ps.current_index+1
    where ps.id=s_rec.id
    returning ps.* into s_rec;
  end if;

  return query select s_rec.id,s_rec.question_count,s_rec.current_index,s_rec.status,s_rec.total_score;
end $$;

create or replace function public.get_practice_summary(p_session_id uuid)
returns table(
  ordinal int,
  prompt text,
  category text,
  unit text,
  score int,
  your_answer text,
  correct_answer text
)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not exists(
    select 1 from public.practice_sessions ps
    where ps.id=p_session_id and ps.user_id=auth.uid()
  ) then raise exception 'Practice session not found'; end if;

  return query
  select
    pq.ordinal,
    q.prompt,
    q.category,
    q.unit,
    pa.score,
    case
      when q.question_type='multiple_choice' then coalesce(q.options->>(pa.answer_value::int),pa.answer_value)
      else pa.answer_value
    end,
    case
      when q.question_type='multiple_choice' then q.options->>q.correct_option
      when q.question_type='text' then q.answer_text
      else q.answer_numeric::text
    end
  from public.practice_questions pq
  join public.questions q on q.id=pq.question_id
  join public.practice_answers pa on pa.session_id=pq.session_id and pa.ordinal=pq.ordinal
  where pq.session_id=p_session_id
  order by pq.ordinal;
exception
  when invalid_text_representation then
    raise exception 'Practice summary contains an invalid stored choice';
end $$;

-- -----------------------------------------------------------------------------
-- RPC privilege hardening. CREATE FUNCTION grants EXECUTE to PUBLIC by default;
-- revoke that broad grant for authenticated-only game actions.
-- -----------------------------------------------------------------------------
revoke execute on function public.get_current_question(uuid) from public,anon;
revoke execute on function public.submit_game_answer(uuid,text,int) from public,anon;
revoke execute on function public.next_round(uuid) from public,anon;
revoke execute on function public.get_practice_question(uuid) from public,anon;
revoke execute on function public.submit_practice_answer(uuid,text,int) from public,anon;
revoke execute on function public.next_practice_question(uuid) from public,anon;
revoke execute on function public.get_practice_summary(uuid) from public,anon;

-- Other authenticated RPCs from earlier migrations.
revoke execute on function public.start_practice(text[],text,int) from public,anon;
revoke execute on function public.get_daily_state() from public,anon;
revoke execute on function public.submit_daily_answer(text) from public,anon;
revoke execute on function public.create_lobby(text,text,int,int,text,int,text) from public,anon;
revoke execute on function public.join_lobby(text) from public,anon;
revoke execute on function public.get_lobby_players(uuid) from public,anon;
revoke execute on function public.start_lobby(uuid) from public,anon;
revoke execute on function public.reveal_round(uuid) from public,anon;
revoke execute on function public.get_round_results(uuid) from public,anon;
revoke execute on function public.update_my_profile(text) from public,anon;
revoke execute on function public.sync_my_google_profile() from public,anon;
revoke execute on function public.admin_add_question(text,text,text,text,text,text,jsonb,numeric,text,int,text,text) from public,anon;
revoke execute on function public.get_daily_question() from public,anon;

-- get_lobby(text) intentionally remains available to anon for code/link discovery.
grant execute on function public.get_current_question(uuid) to authenticated;
grant execute on function public.submit_game_answer(uuid,text,int) to authenticated;
grant execute on function public.next_round(uuid) to authenticated;
grant execute on function public.start_practice(text[],text,int) to authenticated;
grant execute on function public.get_practice_question(uuid) to authenticated;
grant execute on function public.submit_practice_answer(uuid,text,int) to authenticated;
grant execute on function public.next_practice_question(uuid) to authenticated;
grant execute on function public.get_practice_summary(uuid) to authenticated;
grant execute on function public.get_daily_state() to authenticated;
grant execute on function public.submit_daily_answer(text) to authenticated;
grant execute on function public.create_lobby(text,text,int,int,text,int,text) to authenticated;
grant execute on function public.join_lobby(text) to authenticated;
grant execute on function public.get_lobby_players(uuid) to authenticated;
grant execute on function public.start_lobby(uuid) to authenticated;
grant execute on function public.reveal_round(uuid) to authenticated;
grant execute on function public.get_round_results(uuid) to authenticated;
grant execute on function public.update_my_profile(text) to authenticated;
grant execute on function public.sync_my_google_profile() to authenticated;
grant execute on function public.admin_add_question(text,text,text,text,text,text,jsonb,numeric,text,int,text,text) to authenticated;
grant execute on function public.get_daily_question() to authenticated;


-- ============================================================
-- V5 Realtime lobby roster sync (included for fresh installs)
-- ============================================================
create or replace function public.is_game_participant(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null
     and (
       exists (select 1 from public.games g where g.id = p_game_id and g.host_id = (select auth.uid()))
       or exists (select 1 from public.game_players gp where gp.game_id = p_game_id and gp.user_id = (select auth.uid()))
     );
$$;
revoke all on function public.is_game_participant(uuid) from public, anon;
grant execute on function public.is_game_participant(uuid) to authenticated;

drop policy if exists "games participant read" on public.games;
create policy "games participant read" on public.games for select to authenticated
using (public.is_game_participant(id));

drop policy if exists "players participant read" on public.game_players;
create policy "players participant read" on public.game_players for select to authenticated
using (public.is_game_participant(game_id));

revoke insert, update, delete on table public.games from anon, authenticated;
revoke insert, update, delete on table public.game_players from anon, authenticated;
grant select on table public.games, public.game_players to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='games') then
    alter publication supabase_realtime add table public.games;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='game_players') then
    alter publication supabase_realtime add table public.game_players;
  end if;
end $$;

alter table public.games replica identity full;
alter table public.game_players replica identity full;
create index if not exists game_players_user_game_idx on public.game_players(user_id, game_id);


-- ============================================================================
-- RECONCILE: 006_library_community_media.sql
-- ============================================================================
-- WhatMod Trivia V6 - Community graphs, replay library, question media, and efficient snapshots
-- Safe upgrade for an existing V5 project. No existing profile/game/question data is reset.

-- -----------------------------------------------------------------------------
-- Question media + external-source metadata. Images remain external URLs so the
-- database stores only a few strings, not image bytes.
-- -----------------------------------------------------------------------------
alter table public.questions add column if not exists image_url text;
alter table public.questions add column if not exists image_alt text;
alter table public.questions add column if not exists image_source_url text;
alter table public.questions add column if not exists image_attribution text;
alter table public.questions add column if not exists image_license text;
alter table public.questions add column if not exists image_license_url text;
alter table public.questions add column if not exists source_type text;
alter table public.questions add column if not exists source_entity_id text;
alter table public.questions add column if not exists canonical_key text;

create unique index if not exists questions_canonical_key_unique
  on public.questions(canonical_key);
create index if not exists questions_source_entity_idx
  on public.questions(source_type,source_entity_id)
  where source_entity_id is not null;

-- -----------------------------------------------------------------------------
-- Community answer clustering.
-- Exactly ONE compact row is kept per answered numeric question. We never need
-- one analytics row per user. The 41 bigint bins represent log10(guess/answer)
-- from -4x decades to +4 decades in 0.2-decade steps. Values beyond that are
-- folded into the end buckets. This stays ~constant-size as participation grows.
-- -----------------------------------------------------------------------------
create table if not exists public.question_answer_stats (
  question_id uuid primary key references public.questions(id) on delete cascade,
  total_answers bigint not null default 0 check(total_answers >= 0),
  histogram bigint[] not null default array_fill(0::bigint,array[41]),
  first_answered_at timestamptz,
  last_answered_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint question_answer_stats_histogram_len check(array_length(histogram,1)=41)
);

alter table public.question_answer_stats enable row level security;
revoke all on public.question_answer_stats from anon,authenticated;

create or replace function public.bump_histogram(p_hist bigint[],p_position int)
returns bigint[]
language plpgsql
immutable
set search_path=public
as $$
declare
  v bigint[] := coalesce(p_hist,array_fill(0::bigint,array[41]));
  pos int := greatest(1,least(41,p_position));
begin
  v[pos] := coalesce(v[pos],0)+1;
  return v;
end $$;

revoke all on function public.bump_histogram(bigint[],int) from public,anon,authenticated;

create or replace function public.record_question_numeric_answer(p_question_id uuid,p_guess numeric)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  actual numeric;
  log_ratio numeric;
  idx int;
  seeded bigint[];
begin
  if p_question_id is null or p_guess is null then return; end if;

  select q.answer_numeric into actual
  from public.questions q
  where q.id=p_question_id and q.question_type='numeric';

  if actual is null then return; end if;

  -- Positive Fermi estimates get a logarithmic ratio bucket. For the rare
  -- zero/negative numeric question, use a signed normalized error bucket.
  if actual>0 and p_guess>0 then
    log_ratio := greatest(-4::numeric,least(4::numeric,log(10,p_guess/actual)));
  else
    log_ratio := greatest(-4::numeric,least(4::numeric,(p_guess-actual)/greatest(abs(actual),1)));
  end if;

  idx := greatest(0,least(40,round((log_ratio+4)/0.2)::int));
  seeded := array_fill(0::bigint,array[41]);
  seeded[idx+1] := 1;

  insert into public.question_answer_stats(question_id,total_answers,histogram,first_answered_at,last_answered_at,updated_at)
  values(p_question_id,1,seeded,now(),now(),now())
  on conflict(question_id) do update
    set total_answers=public.question_answer_stats.total_answers+1,
        histogram=public.bump_histogram(public.question_answer_stats.histogram,idx+1),
        last_answered_at=now(),
        updated_at=now();
end $$;

revoke all on function public.record_question_numeric_answer(uuid,numeric) from public,anon,authenticated;

create or replace function public.capture_daily_numeric_answer()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.answer_numeric is not null then
    perform public.record_question_numeric_answer(new.question_id,new.answer_numeric);
  end if;
  return new;
end $$;

drop trigger if exists capture_daily_numeric_answer on public.daily_attempts;
create trigger capture_daily_numeric_answer after insert on public.daily_attempts
for each row execute function public.capture_daily_numeric_answer();

create or replace function public.capture_practice_numeric_answer()
returns trigger language plpgsql security definer set search_path=public as $$
declare qid uuid;
begin
  if new.answer_numeric is null then return new; end if;
  select pq.question_id into qid
  from public.practice_questions pq
  where pq.session_id=new.session_id and pq.ordinal=new.ordinal;
  if qid is not null then perform public.record_question_numeric_answer(qid,new.answer_numeric); end if;
  return new;
end $$;

drop trigger if exists capture_practice_numeric_answer on public.practice_answers;
create trigger capture_practice_numeric_answer after insert on public.practice_answers
for each row execute function public.capture_practice_numeric_answer();

create or replace function public.capture_game_numeric_answer()
returns trigger language plpgsql security definer set search_path=public as $$
declare qid uuid;
begin
  if new.answer_numeric is null then return new; end if;
  select gq.question_id into qid
  from public.game_questions gq
  where gq.game_id=new.game_id and gq.ordinal=new.ordinal;
  if qid is not null then perform public.record_question_numeric_answer(qid,new.answer_numeric); end if;
  return new;
end $$;

drop trigger if exists capture_game_numeric_answer on public.game_answers;
create trigger capture_game_numeric_answer after insert on public.game_answers
for each row execute function public.capture_game_numeric_answer();

-- Backfill existing numeric answers once. A non-empty stats table means this
-- migration (or live triggers) already populated it, so reruns do not double-count.
do $$
declare r record;
begin
  if not exists(select 1 from public.question_answer_stats limit 1) then
    for r in
      select d.question_id as qid,d.answer_numeric as guess from public.daily_attempts d where d.answer_numeric is not null
      union all
      select pq.question_id,pa.answer_numeric from public.practice_answers pa
        join public.practice_questions pq on pq.session_id=pa.session_id and pq.ordinal=pa.ordinal
        where pa.answer_numeric is not null
      union all
      select gq.question_id,ga.answer_numeric from public.game_answers ga
        join public.game_questions gq on gq.game_id=ga.game_id and gq.ordinal=ga.ordinal
        where ga.answer_numeric is not null
    loop
      perform public.record_question_numeric_answer(r.qid,r.guess);
    end loop;
  end if;
end $$;

create or replace function public.get_question_community_stats(p_question_id uuid)
returns table(
  total_answers bigint,
  histogram bigint[],
  bucket_min numeric,
  bucket_max numeric,
  bucket_step numeric,
  first_answered_at timestamptz,
  last_answered_at timestamptz
)
language sql
security definer
set search_path=public
as $$
  select
    coalesce(s.total_answers,0),
    coalesce(s.histogram,array_fill(0::bigint,array[41])),
    -4::numeric,
    4::numeric,
    0.2::numeric,
    s.first_answered_at,
    s.last_answered_at
  from (select 1) x
  left join public.question_answer_stats s on s.question_id=p_question_id;
$$;

grant execute on function public.get_question_community_stats(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Compact public Replay Library. A replay stores only an ordered uuid[] of
-- questions plus metadata. Question text/answers are NOT duplicated.
-- -----------------------------------------------------------------------------
create table if not exists public.library_sessions (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  title text not null,
  description text,
  source_kind text not null default 'practice' check(source_kind in ('practice','party','curated','imported')),
  created_by uuid references auth.users(id) on delete set null,
  categories text[] not null default array[]::text[],
  difficulty text not null default 'any',
  question_count integer not null check(question_count between 1 and 50),
  question_ids uuid[] not null,
  cover_image_url text,
  cover_image_alt text,
  cover_image_source_url text,
  cover_image_attribution text,
  cover_image_license text,
  cover_image_license_url text,
  play_count bigint not null default 0 check(play_count>=0),
  times_generated bigint not null default 1 check(times_generated>=1),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_session_question_count check(cardinality(question_ids)=question_count)
);

create index if not exists library_sessions_created_idx on public.library_sessions(created_at desc);
create index if not exists library_sessions_popular_idx on public.library_sessions(play_count desc,created_at desc);
create index if not exists library_sessions_categories_gin on public.library_sessions using gin(categories);

alter table public.library_sessions enable row level security;
revoke all on public.library_sessions from anon,authenticated;

alter table public.practice_sessions add column if not exists library_session_id uuid references public.library_sessions(id) on delete set null;
alter table public.practice_sessions add column if not exists origin_library_session_id uuid references public.library_sessions(id) on delete set null;
alter table public.games add column if not exists library_session_id uuid references public.library_sessions(id) on delete set null;

create or replace function public.make_library_snapshot(
  p_question_ids uuid[],
  p_source_kind text,
  p_created_by uuid,
  p_categories text[] default array[]::text[],
  p_difficulty text default 'any',
  p_title text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  fp text;
  lib_id uuid;
  cats text[];
  qcount int;
  auto_title text;
  cover record;
begin
  qcount:=coalesce(cardinality(p_question_ids),0);
  if qcount<1 then return null; end if;
  fp:=md5(array_to_string(p_question_ids,','));

  select coalesce(array_agg(distinct q.category order by q.category),array[]::text[])
  into cats
  from public.questions q
  where q.id=any(p_question_ids);

  if coalesce(cardinality(p_categories),0)>0 then cats:=p_categories; end if;

  auto_title:=coalesce(nullif(trim(p_title),''),
    case
      when cardinality(cats)=1 then cats[1]||' Replay • '||qcount||'Q'
      when cardinality(cats)=2 then cats[1]||' + '||cats[2]||' • '||qcount||'Q'
      else 'Mixed Knowledge • '||qcount||'Q'
    end);

  select q.image_url,q.image_alt,q.image_source_url,q.image_attribution,q.image_license,q.image_license_url
  into cover
  from unnest(p_question_ids) with ordinality ids(id,ord)
  join public.questions q on q.id=ids.id
  where q.image_url is not null
  order by ids.ord
  limit 1;

  insert into public.library_sessions(
    fingerprint,title,description,source_kind,created_by,categories,difficulty,question_count,question_ids,
    cover_image_url,cover_image_alt,cover_image_source_url,cover_image_attribution,cover_image_license,cover_image_license_url
  ) values(
    fp,auto_title,
    case when p_source_kind='party' then 'A completed Party Mode question set, preserved for replay.' else 'A completed Practice question set, preserved for replay.' end,
    case when p_source_kind in('practice','party','curated','imported') then p_source_kind else 'practice' end,
    p_created_by,cats,coalesce(p_difficulty,'any'),qcount,p_question_ids,
    cover.image_url,cover.image_alt,cover.image_source_url,cover.image_attribution,cover.image_license,cover.image_license_url
  )
  on conflict(fingerprint) do update
    set times_generated=public.library_sessions.times_generated+1,
        updated_at=now(),
        cover_image_url=coalesce(public.library_sessions.cover_image_url,excluded.cover_image_url),
        cover_image_alt=coalesce(public.library_sessions.cover_image_alt,excluded.cover_image_alt),
        cover_image_source_url=coalesce(public.library_sessions.cover_image_source_url,excluded.cover_image_source_url),
        cover_image_attribution=coalesce(public.library_sessions.cover_image_attribution,excluded.cover_image_attribution),
        cover_image_license=coalesce(public.library_sessions.cover_image_license,excluded.cover_image_license),
        cover_image_license_url=coalesce(public.library_sessions.cover_image_license_url,excluded.cover_image_license_url)
  returning id into lib_id;

  return lib_id;
end $$;

revoke all on function public.make_library_snapshot(uuid[],text,uuid,text[],text,text) from public,anon,authenticated;

create or replace function public.snapshot_completed_practice()
returns trigger language plpgsql security definer set search_path=public as $$
declare ids uuid[]; lib uuid;
begin
  if new.status='completed' and old.status is distinct from new.status and new.library_session_id is null then
    select array_agg(pq.question_id order by pq.ordinal) into ids
    from public.practice_questions pq where pq.session_id=new.id;
    lib:=public.make_library_snapshot(ids,'practice',new.user_id,new.categories,new.difficulty,null);
    update public.practice_sessions ps set library_session_id=lib where ps.id=new.id;
  end if;
  return new;
end $$;

drop trigger if exists snapshot_completed_practice on public.practice_sessions;
create trigger snapshot_completed_practice after update of status on public.practice_sessions
for each row execute function public.snapshot_completed_practice();

create or replace function public.snapshot_completed_game()
returns trigger language plpgsql security definer set search_path=public as $$
declare ids uuid[]; cats text[]; lib uuid;
begin
  if new.status='finished' and old.status is distinct from new.status and new.library_session_id is null then
    select array_agg(gq.question_id order by gq.ordinal) into ids
    from public.game_questions gq where gq.game_id=new.id;
    select coalesce(array_agg(distinct q.category order by q.category),array[]::text[]) into cats
    from public.game_questions gq join public.questions q on q.id=gq.question_id
    where gq.game_id=new.id;
    lib:=public.make_library_snapshot(ids,'party',new.host_id,cats,new.difficulty,null);
    update public.games g set library_session_id=lib where g.id=new.id;
  end if;
  return new;
end $$;

drop trigger if exists snapshot_completed_game on public.games;
create trigger snapshot_completed_game after update of status on public.games
for each row execute function public.snapshot_completed_game();

-- Snapshot already-completed rounds from before V6 once.
do $$
declare r record; ids uuid[]; cats text[]; lib uuid;
begin
  for r in select ps.* from public.practice_sessions ps where ps.status='completed' and ps.library_session_id is null loop
    select array_agg(pq.question_id order by pq.ordinal) into ids from public.practice_questions pq where pq.session_id=r.id;
    lib:=public.make_library_snapshot(ids,'practice',r.user_id,r.categories,r.difficulty,null);
    update public.practice_sessions set library_session_id=lib where id=r.id;
  end loop;

  for r in select g.* from public.games g where g.status='finished' and g.library_session_id is null loop
    select array_agg(gq.question_id order by gq.ordinal) into ids from public.game_questions gq where gq.game_id=r.id;
    select coalesce(array_agg(distinct q.category order by q.category),array[]::text[]) into cats
    from public.game_questions gq join public.questions q on q.id=gq.question_id where gq.game_id=r.id;
    lib:=public.make_library_snapshot(ids,'party',r.host_id,cats,r.difficulty,null);
    update public.games set library_session_id=lib where id=r.id;
  end loop;
end $$;

create or replace function public.get_library_sessions(
  p_search text default null,
  p_category text default null,
  p_difficulty text default null,
  p_sort text default 'new',
  p_limit int default 30,
  p_offset int default 0
)
returns table(
  id uuid,title text,description text,source_kind text,categories text[],difficulty text,question_count int,
  cover_image_url text,cover_image_alt text,cover_image_source_url text,cover_image_attribution text,
  cover_image_license text,cover_image_license_url text,play_count bigint,times_generated bigint,created_at timestamptz,
  total_count bigint
)
language plpgsql security definer set search_path=public as $$
begin
  return query
  select
    ls.id,ls.title,ls.description,ls.source_kind,ls.categories,ls.difficulty,ls.question_count,
    ls.cover_image_url,ls.cover_image_alt,ls.cover_image_source_url,ls.cover_image_attribution,
    ls.cover_image_license,ls.cover_image_license_url,ls.play_count,ls.times_generated,ls.created_at,
    count(*) over() as total_count
  from public.library_sessions ls
  where ls.is_public
    and (nullif(trim(coalesce(p_search,'')),'') is null
      or ls.title ilike '%'||trim(p_search)||'%'
      or coalesce(ls.description,'') ilike '%'||trim(p_search)||'%')
    and (nullif(trim(coalesce(p_category,'')),'') is null or p_category=any(ls.categories))
    and (coalesce(p_difficulty,'any')='any' or ls.difficulty=p_difficulty or ls.difficulty='any')
  order by
    case when p_sort='popular' then ls.play_count end desc nulls last,
    case when p_sort='popular' then ls.times_generated end desc nulls last,
    ls.created_at desc
  limit greatest(1,least(60,coalesce(p_limit,30)))
  offset greatest(0,coalesce(p_offset,0));
end $$;

grant execute on function public.get_library_sessions(text,text,text,text,int,int) to anon,authenticated;

create or replace function public.start_library_practice(p_library_session_id uuid)
returns table(session_id uuid,question_count int,current_index int,status text,total_score int)
language plpgsql security definer set search_path=public as $$
declare ls public.library_sessions; sid uuid; i record;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select x.* into ls from public.library_sessions x where x.id=p_library_session_id and x.is_public for update;
  if ls.id is null then raise exception 'Library session not found'; end if;

  insert into public.practice_sessions(user_id,categories,difficulty,question_count,origin_library_session_id)
  values(auth.uid(),ls.categories,ls.difficulty,ls.question_count,ls.id)
  returning id into sid;

  insert into public.practice_questions(session_id,ordinal,question_id)
  select sid,(u.ord-1)::int,u.qid
  from unnest(ls.question_ids) with ordinality u(qid,ord)
  order by u.ord;

  update public.library_sessions x set play_count=x.play_count+1,updated_at=now() where x.id=ls.id;
  return query select sid,ls.question_count,0,'active'::text,0;
end $$;

grant execute on function public.start_library_practice(uuid) to authenticated;

-- Keep the Replay Library permanent while allowing raw completed Practice runs
-- to be pruned. This is safe because library_sessions stores the ordered question ids.
create or replace function public.prune_ephemeral_practice(p_days int default 30)
returns bigint
language plpgsql security definer set search_path=public as $$
declare deleted_count bigint;
begin
  delete from public.practice_sessions ps
  where ps.status='completed'
    and ps.completed_at < now()-make_interval(days=>greatest(7,least(365,coalesce(p_days,30))));
  get diagnostics deleted_count = row_count;
  return deleted_count;
end $$;

revoke all on function public.prune_ephemeral_practice(int) from public,anon,authenticated;
grant execute on function public.prune_ephemeral_practice(int) to service_role;

-- -----------------------------------------------------------------------------
-- V6 media-aware question RPCs. Versioned names avoid changing the declared
-- return types of existing RPCs in-place.
-- -----------------------------------------------------------------------------
create or replace function public.get_daily_state_v6()
returns table(
  id uuid,daily_number bigint,category text,difficulty text,question_type text,prompt text,context text,unit text,options jsonb,
  image_url text,image_alt text,image_source_url text,image_attribution text,image_license text,image_license_url text,
  already_played boolean,score int,xp_awarded int,your_answer numeric,answer_numeric numeric,answer_text text,answer_display text,explanation text
)
language sql security definer set search_path=public as $$
  with mine as (
    select d.* from public.daily_attempts d where d.day=current_date and d.user_id=auth.uid() limit 1
  ), chosen as (
    select coalesce((select question_id from mine),public.daily_question_id(current_date)) as question_id
  )
  select q.id,(current_date-date '2026-01-01')::bigint+1,q.category,q.difficulty,q.question_type,q.prompt,q.context,q.unit,q.options,
    q.image_url,q.image_alt,q.image_source_url,q.image_attribution,q.image_license,q.image_license_url,
    exists(select 1 from mine),d.score,d.xp_awarded,d.answer_numeric,
    case when d.user_id is not null then q.answer_numeric else null end,
    case when d.user_id is not null then q.answer_text else null end,
    case when d.user_id is not null and q.question_type='multiple_choice' then q.options->>q.correct_option else null end,
    case when d.user_id is not null then q.explanation else null end
  from chosen c join public.questions q on q.id=c.question_id left join mine d on true;
$$;

grant execute on function public.get_daily_state_v6() to authenticated;

create or replace function public.get_practice_question_v6(p_session_id uuid)
returns table(
  session_id uuid,ordinal int,question_count int,total_score int,status text,id uuid,category text,difficulty text,question_type text,
  prompt text,context text,unit text,options jsonb,image_url text,image_alt text,image_source_url text,image_attribution text,
  image_license text,image_license_url text,answered boolean,score int,your_answer text,answer_numeric numeric,answer_text text,
  answer_display text,explanation text
)
language plpgsql security definer set search_path=public as $$
declare s_rec public.practice_sessions;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select ps.* into s_rec from public.practice_sessions ps where ps.id=p_session_id and ps.user_id=auth.uid();
  if s_rec.id is null then raise exception 'Practice session not found'; end if;

  return query
  select s_rec.id,s_rec.current_index,s_rec.question_count,s_rec.total_score,s_rec.status,q.id,q.category,q.difficulty,q.question_type,
    q.prompt,q.context,q.unit,q.options,q.image_url,q.image_alt,q.image_source_url,q.image_attribution,q.image_license,q.image_license_url,
    (pa.session_id is not null),pa.score,pa.answer_value,
    case when pa.session_id is not null then q.answer_numeric else null end,
    case when pa.session_id is not null then q.answer_text else null end,
    case when pa.session_id is null then null when q.question_type='multiple_choice' then q.options->>q.correct_option when q.question_type='text' then q.answer_text else q.answer_numeric::text end,
    case when pa.session_id is not null then q.explanation else null end
  from public.practice_questions pq
  join public.questions q on q.id=pq.question_id
  left join public.practice_answers pa on pa.session_id=pq.session_id and pa.ordinal=pq.ordinal
  where pq.session_id=s_rec.id and pq.ordinal=s_rec.current_index;
end $$;

grant execute on function public.get_practice_question_v6(uuid) to authenticated;

create or replace function public.get_current_question_v6(p_game_id uuid)
returns table(
  id uuid,ordinal int,category text,difficulty text,question_type text,prompt text,context text,unit text,options jsonb,
  image_url text,image_alt text,image_source_url text,image_attribution text,image_license text,image_license_url text,
  answer_numeric numeric,answer_text text,answer_display text,explanation text
)
language plpgsql security definer set search_path=public as $$
declare g_rec public.games;
begin
  select g0.* into g_rec from public.games g0 where g0.id=p_game_id;
  if g_rec.id is null then raise exception 'Game not found'; end if;
  if not exists(select 1 from public.game_players gp where gp.game_id=p_game_id and gp.user_id=auth.uid()) then raise exception 'Not in game'; end if;

  return query
  select q.id,g_rec.current_question_index,q.category,q.difficulty,q.question_type,q.prompt,q.context,q.unit,q.options,
    q.image_url,q.image_alt,q.image_source_url,q.image_attribution,q.image_license,q.image_license_url,
    case when g_rec.status in('results','finished') then q.answer_numeric else null end,
    case when g_rec.status in('results','finished') then q.answer_text else null end,
    case when g_rec.status in('results','finished') and q.question_type='multiple_choice' then q.options->>q.correct_option else null end,
    case when g_rec.status in('results','finished') then q.explanation else null end
  from public.game_questions gq join public.questions q on q.id=gq.question_id
  where gq.game_id=p_game_id and gq.ordinal=g_rec.current_question_index;
end $$;

grant execute on function public.get_current_question_v6(uuid) to authenticated;


-- ============================================================================
-- RECONCILE: 007_media_resolver_admin.sql
-- ============================================================================
-- WhatMod Trivia V7
-- Media Resolver V2 + /triviaadmin moderation APIs
-- Safe to run after 006_library_community_media.sql.

begin;

alter table public.questions add column if not exists media_query text;
alter table public.questions add column if not exists media_provider text;
alter table public.questions add column if not exists media_review_status text not null default 'unreviewed';
alter table public.questions add column if not exists media_locked boolean not null default false;
alter table public.questions add column if not exists media_candidate_id uuid;
alter table public.questions add column if not exists media_updated_at timestamptz;
alter table public.questions add column if not exists media_last_resolved_at timestamptz;

-- Existing media remains visible immediately. It is simply marked as auto/unreviewed
-- until an admin explicitly approves/locks it.
update public.questions q
set media_review_status = case
      when q.image_url is not null and q.media_review_status='unreviewed' then 'auto'
      else q.media_review_status
    end,
    media_provider = coalesce(q.media_provider,
      case
        when q.image_source_url ilike '%commons.wikimedia.org%' then 'wikimedia'
        when q.image_source_url ilike '%wikipedia.org%' then 'wikipedia'
        when q.image_source_url ilike '%openverse.org%' then 'openverse'
        else null
      end),
    media_query = coalesce(nullif(q.media_query,''), nullif(q.image_alt,'')),
    media_updated_at = coalesce(q.media_updated_at, case when q.image_url is not null then now() else null end)
where q.image_url is not null or q.image_alt is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.questions'::regclass and conname='questions_media_review_status_check'
  ) then
    alter table public.questions add constraint questions_media_review_status_check
      check (media_review_status in ('unreviewed','auto','approved','rejected','none'));
  end if;
end $$;

create table if not exists public.question_media_candidates (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  provider text not null,
  provider_key text not null,
  title text,
  image_url text not null,
  thumbnail_url text,
  source_url text,
  creator text,
  creator_url text,
  license text,
  license_url text,
  width integer,
  height integer,
  score numeric not null default 0,
  auto_eligible boolean not null default false,
  is_available boolean not null default true,
  status text not null default 'candidate',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_checked_at timestamptz,
  unique(question_id,provider,provider_key),
  constraint question_media_candidate_status_check
    check (status in ('candidate','auto_selected','selected','approved','rejected'))
);

create index if not exists question_media_candidates_question_idx
  on public.question_media_candidates(question_id, status, score desc);
create index if not exists question_media_candidates_provider_idx
  on public.question_media_candidates(provider, updated_at desc);

alter table public.question_media_candidates enable row level security;
revoke all on public.question_media_candidates from public,anon,authenticated;

-- Keep candidate FK optional so older installs remain migration-friendly.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.questions'::regclass and conname='questions_media_candidate_fk'
  ) then
    alter table public.questions
      add constraint questions_media_candidate_fk
      foreign key (media_candidate_id)
      references public.question_media_candidates(id)
      on delete set null;
  end if;
end $$;

create or replace function public.is_trivia_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.profiles p
    where p.user_id=auth.uid() and p.is_admin=true
  );
$$;

revoke all on function public.is_trivia_admin() from public,anon;
grant execute on function public.is_trivia_admin() to authenticated;

create or replace function public.admin_media_overview()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare out_json jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select jsonb_build_object(
    'total_questions', count(*),
    'with_image', count(*) filter (where q.image_url is not null),
    'missing_image', count(*) filter (where q.image_url is null),
    'approved', count(*) filter (where q.media_review_status='approved'),
    'auto', count(*) filter (where q.media_review_status='auto'),
    'locked', count(*) filter (where q.media_locked),
    'needs_resolution', count(*) filter (where not q.media_locked and q.image_url is null),
    'candidates', (select count(*) from public.question_media_candidates c),
    'last_resolved_at', max(q.media_last_resolved_at)
  ) into out_json
  from public.questions q
  where q.is_active;
  return out_json;
end $$;

create or replace function public.admin_list_media_questions(
  p_search text default null,
  p_media_filter text default 'all',
  p_provider text default null,
  p_category text default null,
  p_limit integer default 40,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare out_json jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  p_limit:=greatest(1,least(coalesce(p_limit,40),100));
  p_offset:=greatest(0,coalesce(p_offset,0));

  with filtered as (
    select q.*
    from public.questions q
    where q.is_active
      and (p_search is null or trim(p_search)='' or q.prompt ilike '%'||trim(p_search)||'%' or coalesce(q.media_query,'') ilike '%'||trim(p_search)||'%')
      and (p_provider is null or trim(p_provider)='' or q.media_provider=p_provider)
      and (p_category is null or trim(p_category)='' or q.category=p_category)
      and (
        coalesce(p_media_filter,'all')='all'
        or (p_media_filter='missing' and q.image_url is null)
        or (p_media_filter='auto' and q.media_review_status='auto')
        or (p_media_filter='approved' and q.media_review_status='approved')
        or (p_media_filter='locked' and q.media_locked)
        or (p_media_filter='unreviewed' and q.media_review_status in ('unreviewed','auto'))
        or (p_media_filter='rejected' and q.media_review_status='rejected')
      )
  ), paged as (
    select f.*
    from filtered f
    order by
      case when f.image_url is null then 0 else 1 end,
      coalesce(f.media_updated_at,f.created_at) desc,
      f.created_at desc
    limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'total',(select count(*) from filtered),
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'prompt',p.prompt,'category',p.category,'difficulty',p.difficulty,
      'source_url',p.source_url,'source_type',p.source_type,'source_entity_id',p.source_entity_id,
      'media_query',p.media_query,'image_url',p.image_url,'image_alt',p.image_alt,
      'image_source_url',p.image_source_url,'image_attribution',p.image_attribution,
      'image_license',p.image_license,'image_license_url',p.image_license_url,
      'media_provider',p.media_provider,'media_review_status',p.media_review_status,
      'media_locked',p.media_locked,'media_candidate_id',p.media_candidate_id,
      'media_updated_at',p.media_updated_at,'media_last_resolved_at',p.media_last_resolved_at,
      'candidate_count',(select count(*) from public.question_media_candidates c where c.question_id=p.id and c.status<>'rejected')
    )) from paged p),'[]'::jsonb)
  ) into out_json;
  return out_json;
end $$;

create or replace function public.admin_get_question_media(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare out_json jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select jsonb_build_object(
    'question', jsonb_build_object(
      'id',q.id,'prompt',q.prompt,'category',q.category,'difficulty',q.difficulty,
      'source_url',q.source_url,'source_type',q.source_type,'source_entity_id',q.source_entity_id,
      'media_query',q.media_query,'image_url',q.image_url,'image_alt',q.image_alt,
      'image_source_url',q.image_source_url,'image_attribution',q.image_attribution,
      'image_license',q.image_license,'image_license_url',q.image_license_url,
      'media_provider',q.media_provider,'media_review_status',q.media_review_status,
      'media_locked',q.media_locked,'media_candidate_id',q.media_candidate_id,
      'media_updated_at',q.media_updated_at,'media_last_resolved_at',q.media_last_resolved_at
    ),
    'candidates',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'provider',c.provider,'provider_key',c.provider_key,'title',c.title,
      'image_url',c.image_url,'thumbnail_url',c.thumbnail_url,'source_url',c.source_url,
      'creator',c.creator,'creator_url',c.creator_url,'license',c.license,'license_url',c.license_url,
      'width',c.width,'height',c.height,'score',c.score,'auto_eligible',c.auto_eligible,
      'is_available',c.is_available,'status',c.status,'metadata',c.metadata,
      'updated_at',c.updated_at,'last_checked_at',c.last_checked_at
    ) order by
      case c.status when 'approved' then 0 when 'selected' then 1 when 'auto_selected' then 2 else 3 end,
      c.score desc,c.updated_at desc)
      from public.question_media_candidates c where c.question_id=q.id),'[]'::jsonb)
  ) into out_json
  from public.questions q where q.id=p_question_id;
  if out_json is null then raise exception 'Question not found'; end if;
  return out_json;
end $$;

create or replace function public.admin_select_media_candidate(
  p_question_id uuid,
  p_candidate_id uuid,
  p_approve boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare c public.question_media_candidates; chosen_url text;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select x.* into c from public.question_media_candidates x
  where x.id=p_candidate_id and x.question_id=p_question_id and x.status<>'rejected';
  if c.id is null then raise exception 'Media candidate not found'; end if;
  chosen_url:=coalesce(nullif(c.thumbnail_url,''),c.image_url);

  update public.question_media_candidates x
  set status=case when x.id=c.id then case when p_approve then 'approved' else 'selected' end
                  when x.status in ('selected','auto_selected','approved') then 'candidate'
                  else x.status end,
      updated_at=now()
  where x.question_id=p_question_id and x.status<>'rejected';

  update public.questions q set
    image_url=chosen_url,
    image_alt=coalesce(nullif(c.title,''),q.media_query,q.image_alt,q.prompt),
    image_source_url=c.source_url,
    image_attribution=c.creator,
    image_license=c.license,
    image_license_url=c.license_url,
    media_provider=c.provider,
    media_candidate_id=c.id,
    media_review_status=case when p_approve then 'approved' else 'auto' end,
    media_locked=coalesce(p_approve,false),
    media_updated_at=now()
  where q.id=p_question_id;

  return public.admin_get_question_media(p_question_id);
end $$;

create or replace function public.admin_use_external_media(
  p_question_id uuid,
  p_provider text,
  p_provider_key text,
  p_title text,
  p_image_url text,
  p_thumbnail_url text default null,
  p_source_url text default null,
  p_creator text default null,
  p_creator_url text default null,
  p_license text default null,
  p_license_url text default null,
  p_width integer default null,
  p_height integer default null,
  p_score numeric default 100,
  p_auto_eligible boolean default false,
  p_approve boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare cid uuid; normalized_provider text; normalized_key text;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  if p_image_url is null or trim(p_image_url)='' then raise exception 'Image URL required'; end if;
  normalized_provider:=left(coalesce(nullif(trim(p_provider),''),'manual'),60);
  normalized_key:=left(coalesce(nullif(trim(p_provider_key),''),md5(p_image_url)),240);

  insert into public.question_media_candidates(
    question_id,provider,provider_key,title,image_url,thumbnail_url,source_url,creator,creator_url,
    license,license_url,width,height,score,auto_eligible,is_available,status,updated_at,last_checked_at
  ) values(
    p_question_id,normalized_provider,normalized_key,nullif(trim(p_title),''),trim(p_image_url),nullif(trim(p_thumbnail_url),''),
    nullif(trim(p_source_url),''),nullif(trim(p_creator),''),nullif(trim(p_creator_url),''),nullif(trim(p_license),''),
    nullif(trim(p_license_url),''),p_width,p_height,coalesce(p_score,100),coalesce(p_auto_eligible,false),true,'candidate',now(),now()
  ) on conflict(question_id,provider,provider_key) do update set
    title=excluded.title,image_url=excluded.image_url,thumbnail_url=excluded.thumbnail_url,
    source_url=excluded.source_url,creator=excluded.creator,creator_url=excluded.creator_url,
    license=excluded.license,license_url=excluded.license_url,width=excluded.width,height=excluded.height,
    score=excluded.score,auto_eligible=excluded.auto_eligible,is_available=true,
    status=case when public.question_media_candidates.status='rejected' then 'candidate' else public.question_media_candidates.status end,
    updated_at=now(),last_checked_at=now()
  returning id into cid;

  return public.admin_select_media_candidate(p_question_id,cid,p_approve);
end $$;

create or replace function public.admin_approve_current_media(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  update public.questions q
  set media_review_status='approved',media_locked=true,media_updated_at=now()
  where q.id=p_question_id and q.image_url is not null;
  update public.question_media_candidates c
  set status='approved',updated_at=now()
  where c.id=(select q.media_candidate_id from public.questions q where q.id=p_question_id);
  return public.admin_get_question_media(p_question_id);
end $$;

create or replace function public.admin_reject_media_candidate(p_candidate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare qid uuid; was_current boolean;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select c.question_id into qid from public.question_media_candidates c where c.id=p_candidate_id;
  if qid is null then raise exception 'Candidate not found'; end if;
  select exists(select 1 from public.questions q where q.id=qid and q.media_candidate_id=p_candidate_id) into was_current;
  update public.question_media_candidates c set status='rejected',is_available=false,updated_at=now() where c.id=p_candidate_id;
  if was_current then
    update public.questions q set image_url=null,image_source_url=null,image_attribution=null,image_license=null,image_license_url=null,
      media_candidate_id=null,media_provider=null,media_review_status='unreviewed',media_locked=false,media_updated_at=now(),media_last_resolved_at=null
    where q.id=qid;
  end if;
  return public.admin_get_question_media(qid);
end $$;

create or replace function public.admin_clear_question_media(p_question_id uuid,p_lock boolean default true)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  update public.question_media_candidates c
    set status=case when c.status in ('selected','auto_selected','approved') then 'candidate' else c.status end,updated_at=now()
    where c.question_id=p_question_id;
  update public.questions q set
    image_url=null,image_alt=null,image_source_url=null,image_attribution=null,image_license=null,image_license_url=null,
    media_provider=null,media_candidate_id=null,media_review_status=case when p_lock then 'none' else 'unreviewed' end,
    media_locked=coalesce(p_lock,true),media_updated_at=now(),media_last_resolved_at=case when p_lock then now() else null end
  where q.id=p_question_id;
  return public.admin_get_question_media(p_question_id);
end $$;

create or replace function public.admin_unlock_question_media(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  update public.questions q set media_locked=false,
    media_review_status=case when q.image_url is null then 'unreviewed' else 'auto' end,
    media_last_resolved_at=null,media_updated_at=now()
  where q.id=p_question_id;
  return public.admin_get_question_media(p_question_id);
end $$;

create or replace function public.admin_update_media_query(p_question_id uuid,p_query text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  update public.questions q set media_query=nullif(trim(p_query),''),media_last_resolved_at=null,media_updated_at=now()
  where q.id=p_question_id;
  return public.admin_get_question_media(p_question_id);
end $$;

revoke all on function public.admin_media_overview() from public,anon;
revoke all on function public.admin_list_media_questions(text,text,text,text,integer,integer) from public,anon;
revoke all on function public.admin_get_question_media(uuid) from public,anon;
revoke all on function public.admin_select_media_candidate(uuid,uuid,boolean) from public,anon;
revoke all on function public.admin_use_external_media(uuid,text,text,text,text,text,text,text,text,text,text,integer,integer,numeric,boolean,boolean) from public,anon;
revoke all on function public.admin_approve_current_media(uuid) from public,anon;
revoke all on function public.admin_reject_media_candidate(uuid) from public,anon;
revoke all on function public.admin_clear_question_media(uuid,boolean) from public,anon;
revoke all on function public.admin_unlock_question_media(uuid) from public,anon;
revoke all on function public.admin_update_media_query(uuid,text) from public,anon;

grant execute on function public.admin_media_overview() to authenticated;
grant execute on function public.admin_list_media_questions(text,text,text,text,integer,integer) to authenticated;
grant execute on function public.admin_get_question_media(uuid) to authenticated;
grant execute on function public.admin_select_media_candidate(uuid,uuid,boolean) to authenticated;
grant execute on function public.admin_use_external_media(uuid,text,text,text,text,text,text,text,text,text,text,integer,integer,numeric,boolean,boolean) to authenticated;
grant execute on function public.admin_approve_current_media(uuid) to authenticated;
grant execute on function public.admin_reject_media_candidate(uuid) to authenticated;
grant execute on function public.admin_clear_question_media(uuid,boolean) to authenticated;
grant execute on function public.admin_unlock_question_media(uuid) to authenticated;
grant execute on function public.admin_update_media_query(uuid,text) to authenticated;

commit;


-- ============================================================================
-- RECONCILE: 008_hydrator_upsert_fix.sql
-- ============================================================================
-- WhatMod Trivia V7.3 - Hydrator ON CONFLICT compatibility fix
-- Safe for existing installs. PostgreSQL UNIQUE indexes permit multiple NULLs,
-- so canonical_key does not need a partial predicate.

drop index if exists public.questions_canonical_key_unique;

create unique index questions_canonical_key_unique
  on public.questions(canonical_key);

comment on index public.questions_canonical_key_unique is
  'Full unique index used by PostgREST on_conflict=canonical_key for trivia hydrator upserts.';


-- ============================================================================
-- RECONCILE: 009_release_ui_theme.sql
-- ============================================================================
-- Trivia V8: release UI theme preference.
-- Safe for existing projects; no gameplay/progression data is modified.

alter table public.profiles
  add column if not exists ui_theme text not null default 'v2';

alter table public.profiles
  drop constraint if exists profiles_ui_theme_check;

alter table public.profiles
  add constraint profiles_ui_theme_check check (ui_theme in ('v1','v2'));

update public.profiles
set ui_theme='v2'
where ui_theme is null or ui_theme not in ('v1','v2');

create or replace function public.update_my_ui_theme(p_theme text)
returns public.profiles
language plpgsql
security definer
set search_path=public
as $$
declare p public.profiles;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  p_theme:=lower(trim(coalesce(p_theme,'')));
  if p_theme not in ('v1','v2') then raise exception 'Theme must be v1 or v2'; end if;
  update public.profiles
     set ui_theme=p_theme
   where user_id=auth.uid()
   returning * into p;
  if p.user_id is null then raise exception 'Profile not found'; end if;
  return p;
end $$;

revoke execute on function public.update_my_ui_theme(text) from public,anon;
grant execute on function public.update_my_ui_theme(text) to authenticated;


-- ============================================================================
-- RECONCILE: 010_local_media_pipeline.sql
-- ============================================================================
-- WhatMod Trivia V9
-- Local media resolver export/import pipeline + V1 default theme.
-- Safe to run after 009_release_ui_theme.sql.

begin;

-- V1 becomes the default/release theme again. Existing explicit user choices are preserved.
alter table public.profiles
  alter column ui_theme set default 'v1';

create or replace function public.admin_export_media_job(
  p_scope text default 'missing',
  p_limit integer default 1000
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  out_json jsonb;
  scope_name text := lower(trim(coalesce(p_scope,'missing')));
  safe_limit integer := greatest(1, least(coalesce(p_limit,1000),5000));
begin
  if not public.is_trivia_admin() then
    raise exception 'Admin only';
  end if;

  if scope_name not in ('missing','needs_review','auto','all_unlocked') then
    raise exception 'Invalid export scope';
  end if;

  with picked as (
    select q.*
    from public.questions q
    where q.is_active
      and q.media_locked=false
      and (
        (scope_name='missing' and q.image_url is null)
        or (scope_name='needs_review' and (q.image_url is null or q.media_review_status in ('unreviewed','auto')))
        or (scope_name='auto' and q.media_review_status='auto')
        or scope_name='all_unlocked'
      )
    order by
      case when q.image_url is null then 0 else 1 end,
      q.media_last_resolved_at asc nulls first,
      q.created_at asc
    limit safe_limit
  )
  select jsonb_build_object(
    'format','whatmod-trivia-media-job',
    'version',1,
    'job_id',gen_random_uuid(),
    'scope',scope_name,
    'exported_at',now(),
    'question_count',(select count(*) from picked),
    'questions',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',q.id,
          'prompt',q.prompt,
          'category',q.category,
          'difficulty',q.difficulty,
          'media_query',q.media_query,
          'source_type',q.source_type,
          'source_entity_id',q.source_entity_id,
          'source_url',q.source_url,
          'image_url',q.image_url,
          'image_alt',q.image_alt,
          'image_source_url',q.image_source_url,
          'image_attribution',q.image_attribution,
          'image_license',q.image_license,
          'image_license_url',q.image_license_url,
          'media_provider',q.media_provider,
          'media_review_status',q.media_review_status,
          'rejected_candidates',coalesce((
            select jsonb_agg(jsonb_build_object(
              'provider',c.provider,
              'provider_key',c.provider_key
            ))
            from public.question_media_candidates c
            where c.question_id=q.id and c.status='rejected'
          ),'[]'::jsonb)
        )
        order by q.created_at asc
      )
      from picked q
    ),'[]'::jsonb)
  ) into out_json;

  return out_json;
end $$;

create or replace function public.admin_import_media_results(
  p_results jsonb,
  p_auto_publish boolean default true,
  p_skip_locked boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  item jsonb;
  cand jsonb;
  qid uuid;
  qrow public.questions;
  cid uuid;
  selected_provider text;
  selected_key text;
  selected_manual boolean;
  selected_candidate public.question_media_candidates;
  imported_questions integer := 0;
  imported_candidates integer := 0;
  published_questions integer := 0;
  skipped_locked integer := 0;
  skipped_missing integer := 0;
begin
  if not public.is_trivia_admin() then
    raise exception 'Admin only';
  end if;

  if jsonb_typeof(coalesce(p_results,'[]'::jsonb)) <> 'array' then
    raise exception 'p_results must be a JSON array';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_results,'[]'::jsonb))
  loop
    begin
      qid := (item->>'id')::uuid;
    exception when others then
      qid := null;
    end;

    if qid is null then
      skipped_missing := skipped_missing + 1;
      continue;
    end if;

    select q.* into qrow from public.questions q where q.id=qid for update;
    if qrow.id is null then
      skipped_missing := skipped_missing + 1;
      continue;
    end if;

    if coalesce(p_skip_locked,true) and qrow.media_locked then
      skipped_locked := skipped_locked + 1;
      continue;
    end if;

    imported_questions := imported_questions + 1;

    if nullif(trim(item->>'query'),'') is not null then
      update public.questions q
      set media_query=left(trim(item->>'query'),500)
      where q.id=qid;
    end if;

    if jsonb_typeof(item->'candidates')='array' then
      for cand in select value from jsonb_array_elements(item->'candidates')
      loop
        if nullif(trim(cand->>'provider'),'') is null
           or nullif(trim(cand->>'provider_key'),'') is null
           or nullif(trim(cand->>'image_url'),'') is null then
          continue;
        end if;

        insert into public.question_media_candidates(
          question_id,provider,provider_key,title,image_url,thumbnail_url,source_url,
          creator,creator_url,license,license_url,width,height,score,auto_eligible,
          is_available,status,metadata,updated_at,last_checked_at
        ) values (
          qid,
          left(trim(cand->>'provider'),60),
          left(trim(cand->>'provider_key'),240),
          nullif(left(trim(coalesce(cand->>'title','')),500),''),
          trim(cand->>'image_url'),
          nullif(trim(coalesce(cand->>'thumbnail_url','')),''),
          nullif(trim(coalesce(cand->>'source_url','')),''),
          nullif(left(trim(coalesce(cand->>'creator','')),500),''),
          nullif(trim(coalesce(cand->>'creator_url','')),''),
          nullif(left(trim(coalesce(cand->>'license','')),200),''),
          nullif(trim(coalesce(cand->>'license_url','')),''),
          case when (cand->>'width') ~ '^[0-9]+$' then (cand->>'width')::integer else null end,
          case when (cand->>'height') ~ '^[0-9]+$' then (cand->>'height')::integer else null end,
          case when coalesce(cand->>'score','') ~ '^-?[0-9]+([.][0-9]+)?$' then (cand->>'score')::numeric else 0 end,
          coalesce((cand->>'auto_eligible')::boolean,false),
          coalesce((cand->>'is_available')::boolean,false),
          'candidate',
          coalesce(cand->'metadata','{}'::jsonb),
          now(),now()
        )
        on conflict(question_id,provider,provider_key) do update set
          title=excluded.title,
          image_url=excluded.image_url,
          thumbnail_url=excluded.thumbnail_url,
          source_url=excluded.source_url,
          creator=excluded.creator,
          creator_url=excluded.creator_url,
          license=excluded.license,
          license_url=excluded.license_url,
          width=excluded.width,
          height=excluded.height,
          score=excluded.score,
          auto_eligible=excluded.auto_eligible,
          is_available=excluded.is_available,
          metadata=excluded.metadata,
          status=case
            when public.question_media_candidates.status='rejected' then 'rejected'
            else 'candidate'
          end,
          updated_at=now(),
          last_checked_at=now()
        returning id into cid;

        imported_candidates := imported_candidates + 1;
      end loop;
    end if;

    selected_provider := nullif(trim(item#>>'{selected,provider}'),'');
    selected_key := nullif(trim(item#>>'{selected,provider_key}'),'');
    selected_manual := lower(coalesce(item->>'selection_mode','auto'))='manual';

    if selected_provider is not null and selected_key is not null then
      select c.* into selected_candidate
      from public.question_media_candidates c
      where c.question_id=qid
        and c.provider=selected_provider
        and c.provider_key=selected_key
        and c.status<>'rejected'
        and c.is_available=true
      limit 1;

      if selected_candidate.id is not null
         and coalesce(p_auto_publish,true)
         and (selected_candidate.auto_eligible or selected_manual) then

        update public.question_media_candidates c
        set status=case
          when c.id=selected_candidate.id then 'auto_selected'
          when c.status in ('selected','auto_selected') then 'candidate'
          else c.status
        end,
        updated_at=now()
        where c.question_id=qid and c.status<>'rejected';

        update public.questions q set
          image_url=coalesce(nullif(selected_candidate.thumbnail_url,''),selected_candidate.image_url),
          image_alt=coalesce(nullif(selected_candidate.title,''),q.media_query,q.image_alt,q.prompt),
          image_source_url=selected_candidate.source_url,
          image_attribution=selected_candidate.creator,
          image_license=selected_candidate.license,
          image_license_url=selected_candidate.license_url,
          media_provider=selected_candidate.provider,
          media_candidate_id=selected_candidate.id,
          media_review_status='auto',
          media_locked=false,
          media_updated_at=now(),
          media_last_resolved_at=now()
        where q.id=qid;

        published_questions := published_questions + 1;
      else
        update public.questions q
        set media_last_resolved_at=now(),media_updated_at=now()
        where q.id=qid;
      end if;
    else
      update public.questions q
      set media_last_resolved_at=now(),media_updated_at=now()
      where q.id=qid;
    end if;
  end loop;

  return jsonb_build_object(
    'imported_questions',imported_questions,
    'imported_candidates',imported_candidates,
    'published_questions',published_questions,
    'skipped_locked',skipped_locked,
    'skipped_missing',skipped_missing
  );
end $$;

revoke all on function public.admin_export_media_job(text,integer) from public,anon;
revoke all on function public.admin_import_media_results(jsonb,boolean,boolean) from public,anon;

grant execute on function public.admin_export_media_job(text,integer) to authenticated;
grant execute on function public.admin_import_media_results(jsonb,boolean,boolean) to authenticated;

commit;


-- ============================================================================
-- RECONCILE: 011_question_governance.sql
-- ============================================================================
-- WhatMod Trivia V10
-- Community voting, question governance, admin CRUD/audit, and live admin removal.
-- Safe upgrade for an existing V9 project. Questions removed by admins are
-- retired from all active gameplay immediately while their row is retained as
-- an audit-safe tombstone so historical attempts do not lose referential data.

begin;

alter table public.questions add column if not exists updated_at timestamptz not null default now();
alter table public.questions add column if not exists deleted_at timestamptz;
alter table public.questions add column if not exists deleted_by uuid references auth.users(id) on delete set null;
alter table public.questions add column if not exists delete_reason text;

create index if not exists questions_active_updated_idx
  on public.questions(is_active,updated_at desc);

-- -----------------------------------------------------------------------------
-- Community votes. One signed-in user gets one vote per question. Repeating the
-- same vote toggles it off; choosing the opposite direction switches the vote.
-- -----------------------------------------------------------------------------
create table if not exists public.question_votes (
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check(vote in (-1,1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(question_id,user_id)
);

create index if not exists question_votes_question_idx
  on public.question_votes(question_id,vote);

alter table public.question_votes enable row level security;
revoke all on public.question_votes from public,anon,authenticated;

create or replace function public.get_question_vote_summary(p_question_id uuid)
returns table(upvotes bigint,downvotes bigint,score bigint,my_vote int)
language sql
security definer
set search_path=public
as $$
  select
    count(*) filter(where qv.vote=1)::bigint,
    count(*) filter(where qv.vote=-1)::bigint,
    coalesce(sum(qv.vote),0)::bigint,
    coalesce(max(qv.vote) filter(where qv.user_id=auth.uid()),0)::int
  from public.question_votes qv
  where qv.question_id=p_question_id;
$$;

revoke all on function public.get_question_vote_summary(uuid) from public,anon;
grant execute on function public.get_question_vote_summary(uuid) to authenticated;

create or replace function public.vote_question(p_question_id uuid,p_vote int)
returns table(upvotes bigint,downvotes bigint,score bigint,my_vote int)
language plpgsql
security definer
set search_path=public
as $$
declare existing int;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_vote not in (-1,1) then raise exception 'Vote must be thumbs up or thumbs down'; end if;
  if not exists(select 1 from public.questions q where q.id=p_question_id and q.is_active) then
    raise exception 'Question is no longer active';
  end if;

  select qv.vote into existing
  from public.question_votes qv
  where qv.question_id=p_question_id and qv.user_id=auth.uid();

  if existing=p_vote then
    delete from public.question_votes qv
    where qv.question_id=p_question_id and qv.user_id=auth.uid();
  else
    insert into public.question_votes(question_id,user_id,vote,created_at,updated_at)
    values(p_question_id,auth.uid(),p_vote,now(),now())
    on conflict(question_id,user_id) do update
      set vote=excluded.vote,updated_at=now();
  end if;

  return query select * from public.get_question_vote_summary(p_question_id);
end $$;

revoke all on function public.vote_question(uuid,int) from public,anon;
grant execute on function public.vote_question(uuid,int) to authenticated;

-- -----------------------------------------------------------------------------
-- Append-only admin audit trail. We keep snapshots rather than depending on the
-- mutable question row so a deleted/edited question can always be reconstructed.
-- -----------------------------------------------------------------------------
create table if not exists public.question_audit_log (
  id bigint generated always as identity primary key,
  question_id uuid,
  action text not null check(action in ('create','edit','delete','restore')),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_username text,
  actor_email text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists question_audit_question_idx
  on public.question_audit_log(question_id,created_at desc);
create index if not exists question_audit_action_idx
  on public.question_audit_log(action,created_at desc);

alter table public.question_audit_log enable row level security;
revoke all on public.question_audit_log from public,anon,authenticated;

create or replace function public._audit_question_admin(
  p_question_id uuid,
  p_action text,
  p_before jsonb,
  p_after jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare actor_name text; actor_mail text;
begin
  select p.username into actor_name from public.profiles p where p.user_id=auth.uid();
  select u.email into actor_mail from auth.users u where u.id=auth.uid();
  insert into public.question_audit_log(question_id,action,actor_user_id,actor_username,actor_email,before_data,after_data,metadata)
  values(p_question_id,p_action,auth.uid(),actor_name,actor_mail,p_before,p_after,coalesce(p_metadata,'{}'::jsonb));
end $$;

revoke all on function public._audit_question_admin(uuid,text,jsonb,jsonb,jsonb) from public,anon,authenticated;

-- -----------------------------------------------------------------------------
-- Question explorer APIs
-- -----------------------------------------------------------------------------
create or replace function public.admin_question_overview()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare out_json jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select jsonb_build_object(
    'active',count(*) filter(where q.is_active),
    'retired',count(*) filter(where not q.is_active),
    'manual',count(*) filter(where coalesce(q.source_type,'manual')='manual'),
    'hydrated',count(*) filter(where q.canonical_key is not null),
    'with_votes',(select count(distinct v.question_id) from public.question_votes v),
    'total_upvotes',(select count(*) from public.question_votes v where v.vote=1),
    'total_downvotes',(select count(*) from public.question_votes v where v.vote=-1)
  ) into out_json
  from public.questions q;
  return out_json;
end $$;

revoke all on function public.admin_question_overview() from public,anon;
grant execute on function public.admin_question_overview() to authenticated;

create or replace function public.admin_list_questions_v10(
  p_search text default null,
  p_category text default null,
  p_difficulty text default null,
  p_status text default 'active',
  p_source text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare out_json jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  with vote_totals as (
    select v.question_id,
      count(*) filter(where v.vote=1)::bigint as upvotes,
      count(*) filter(where v.vote=-1)::bigint as downvotes
    from public.question_votes v group by v.question_id
  ), filtered as (
    select q.id,q.prompt,q.category,q.difficulty,q.question_type,q.unit,q.is_active,q.source_type,q.canonical_key,
      q.image_url,q.media_review_status,q.created_at,q.updated_at,q.deleted_at,q.delete_reason,
      coalesce(v.upvotes,0) as upvotes,coalesce(v.downvotes,0) as downvotes,
      count(*) over() as total_count
    from public.questions q
    left join vote_totals v on v.question_id=q.id
    where
      (p_search is null or trim(p_search)='' or q.prompt ilike '%'||trim(p_search)||'%' or coalesce(q.media_query,'') ilike '%'||trim(p_search)||'%' or coalesce(q.canonical_key,'') ilike '%'||trim(p_search)||'%')
      and (p_category is null or p_category='' or q.category=p_category)
      and (p_difficulty is null or p_difficulty='' or p_difficulty='any' or q.difficulty=p_difficulty)
      and (p_status='all' or (p_status='active' and q.is_active) or (p_status='retired' and not q.is_active))
      and (p_source is null or p_source='' or coalesce(q.source_type,'manual')=p_source)
    order by q.is_active desc,q.updated_at desc,q.created_at desc
    limit greatest(1,least(200,coalesce(p_limit,50)))
    offset greatest(0,coalesce(p_offset,0))
  )
  select jsonb_build_object(
    'total',coalesce(max(f.total_count),0),
    'items',coalesce(jsonb_agg(to_jsonb(f)-'total_count'),'[]'::jsonb)
  ) into out_json from filtered f;
  return out_json;
end $$;

revoke all on function public.admin_list_questions_v10(text,text,text,text,text,int,int) from public,anon;
grant execute on function public.admin_list_questions_v10(text,text,text,text,text,int,int) to authenticated;

create or replace function public.admin_get_question_v10(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare out_json jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select jsonb_build_object(
    'question',to_jsonb(q),
    'votes',jsonb_build_object(
      'upvotes',(select count(*) from public.question_votes v where v.question_id=q.id and v.vote=1),
      'downvotes',(select count(*) from public.question_votes v where v.question_id=q.id and v.vote=-1)
    )
  ) into out_json
  from public.questions q where q.id=p_question_id;
  if out_json is null then raise exception 'Question not found'; end if;
  return out_json;
end $$;

revoke all on function public.admin_get_question_v10(uuid) from public,anon;
grant execute on function public.admin_get_question_v10(uuid) to authenticated;

create or replace function public.admin_create_question_v10(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare q public.questions; qtype text; opts jsonb; correct int; numeric_ans numeric; text_ans text;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  qtype:=coalesce(nullif(p_payload->>'question_type',''),'numeric');
  if qtype not in ('numeric','multiple_choice','text') then raise exception 'Invalid question type'; end if;
  if coalesce(length(trim(p_payload->>'prompt')),0)<4 then raise exception 'Question prompt is required'; end if;
  if coalesce(p_payload->>'difficulty','') not in ('easy','medium','hard') then raise exception 'Invalid difficulty'; end if;

  if qtype='numeric' then
    numeric_ans:=nullif(p_payload->>'answer_numeric','')::numeric;
    if numeric_ans is null then raise exception 'Numeric answer is required'; end if;
  elsif qtype='text' then
    text_ans:=nullif(trim(p_payload->>'answer_text'),'');
    if text_ans is null then raise exception 'Text answer is required'; end if;
  else
    opts:=p_payload->'options';
    correct:=nullif(p_payload->>'correct_option','')::int;
    if jsonb_typeof(opts)<>'array' or jsonb_array_length(opts)<2 then raise exception 'At least two answer options are required'; end if;
    if correct is null or correct<0 or correct>=jsonb_array_length(opts) then raise exception 'Correct option is invalid'; end if;
  end if;

  insert into public.questions(category,difficulty,question_type,prompt,context,unit,options,answer_numeric,answer_text,correct_option,explanation,source_url,is_active,created_by,source_type,media_query,updated_at)
  values(
    coalesce(nullif(trim(p_payload->>'category'),''),'General'),p_payload->>'difficulty',qtype,trim(p_payload->>'prompt'),nullif(trim(p_payload->>'context'),''),nullif(trim(p_payload->>'unit'),''),
    case when qtype='multiple_choice' then opts else null end,
    case when qtype='numeric' then numeric_ans else null end,
    case when qtype='text' then text_ans else null end,
    case when qtype='multiple_choice' then correct else null end,
    nullif(trim(p_payload->>'explanation'),''),nullif(trim(p_payload->>'source_url'),''),true,auth.uid(),'manual',nullif(trim(p_payload->>'media_query'),''),now()
  ) returning * into q;

  perform public._audit_question_admin(q.id,'create',null,to_jsonb(q),jsonb_build_object('origin','triviaadmin'));
  return public.admin_get_question_v10(q.id);
end $$;

revoke all on function public.admin_create_question_v10(jsonb) from public,anon;
grant execute on function public.admin_create_question_v10(jsonb) to authenticated;

create or replace function public.admin_update_question_v10(p_question_id uuid,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare before_q public.questions; after_q public.questions; qtype text; opts jsonb; correct int; numeric_ans numeric; text_ans text;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select q.* into before_q from public.questions q where q.id=p_question_id for update;
  if before_q.id is null then raise exception 'Question not found'; end if;

  qtype:=coalesce(nullif(p_payload->>'question_type',''),before_q.question_type);
  if qtype not in ('numeric','multiple_choice','text') then raise exception 'Invalid question type'; end if;

  if qtype='numeric' then
    numeric_ans:=coalesce(nullif(p_payload->>'answer_numeric','')::numeric,before_q.answer_numeric);
    if numeric_ans is null then raise exception 'Numeric answer is required'; end if;
  elsif qtype='text' then
    text_ans:=coalesce(nullif(trim(p_payload->>'answer_text'),''),before_q.answer_text);
    if text_ans is null then raise exception 'Text answer is required'; end if;
  else
    opts:=coalesce(p_payload->'options',before_q.options);
    correct:=coalesce(nullif(p_payload->>'correct_option','')::int,before_q.correct_option);
    if jsonb_typeof(opts)<>'array' or jsonb_array_length(opts)<2 then raise exception 'At least two answer options are required'; end if;
    if correct is null or correct<0 or correct>=jsonb_array_length(opts) then raise exception 'Correct option is invalid'; end if;
  end if;

  update public.questions q set
    category=coalesce(nullif(trim(p_payload->>'category'),''),q.category),
    difficulty=case when p_payload ? 'difficulty' then p_payload->>'difficulty' else q.difficulty end,
    question_type=qtype,
    prompt=coalesce(nullif(trim(p_payload->>'prompt'),''),q.prompt),
    context=case when p_payload ? 'context' then nullif(trim(p_payload->>'context'),'') else q.context end,
    unit=case when p_payload ? 'unit' then nullif(trim(p_payload->>'unit'),'') else q.unit end,
    options=case when qtype='multiple_choice' then opts else null end,
    answer_numeric=case when qtype='numeric' then numeric_ans else null end,
    answer_text=case when qtype='text' then text_ans else null end,
    correct_option=case when qtype='multiple_choice' then correct else null end,
    explanation=case when p_payload ? 'explanation' then nullif(trim(p_payload->>'explanation'),'') else q.explanation end,
    source_url=case when p_payload ? 'source_url' then nullif(trim(p_payload->>'source_url'),'') else q.source_url end,
    media_query=case when p_payload ? 'media_query' then nullif(trim(p_payload->>'media_query'),'') else q.media_query end,
    updated_at=now()
  where q.id=p_question_id returning * into after_q;

  if after_q.difficulty not in ('easy','medium','hard') then raise exception 'Invalid difficulty'; end if;
  perform public._audit_question_admin(p_question_id,'edit',to_jsonb(before_q),to_jsonb(after_q),jsonb_build_object('origin','triviaadmin'));
  return public.admin_get_question_v10(p_question_id);
end $$;

revoke all on function public.admin_update_question_v10(uuid,jsonb) from public,anon;
grant execute on function public.admin_update_question_v10(uuid,jsonb) to authenticated;

-- Finalize an active game after its last playable question is removed. Kept
-- private; callers must already have performed an admin check.
create or replace function public._admin_finalize_game_after_removal(p_game_id uuid,p_rounds int)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare winner_id uuid; rounds int:=greatest(coalesce(p_rounds,0),0);
begin
  select gp.user_id into winner_id from public.game_players gp
  where gp.game_id=p_game_id order by gp.total_score desc,gp.joined_at asc limit 1;

  update public.games g set status='finished',finished_at=now(),question_count=greatest(rounds,1),
    current_question_index=greatest(rounds-1,0)
  where g.id=p_game_id and g.status<>'finished';

  update public.profiles pr
  set games_played=pr.games_played+1,
      wins=pr.wins + case when pr.user_id=winner_id then 1 else 0 end,
      xp=pr.xp + case when rounds>0 then coalesce((select greatest(10,round(gp.total_score::numeric/rounds/20)::int) from public.game_players gp where gp.game_id=p_game_id and gp.user_id=pr.user_id),0) else 0 end
  where exists(select 1 from public.game_players gp where gp.game_id=p_game_id and gp.user_id=pr.user_id);
end $$;

revoke all on function public._admin_finalize_game_after_removal(uuid,int) from public,anon,authenticated;

create or replace function public.admin_delete_question_v10(p_question_id uuid,p_reason text default null,p_practice_session_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  before_q public.questions; after_q public.questions;
  gr record; pr record; doomed int; removed_score int; new_count int;
  games_touched int:=0; practices_touched int:=0;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select q.* into before_q from public.questions q where q.id=p_question_id for update;
  if before_q.id is null then raise exception 'Question not found'; end if;
  if not before_q.is_active then return jsonb_build_object('question_id',p_question_id,'already_deleted',true,'games_touched',0,'practices_touched',0); end if;

  -- Remove/skip the question in every currently active multiplayer match that
  -- already contains it. This causes the games table Realtime event to move all
  -- connected clients to the replacement question automatically.
  for gr in
    select g.*,gq.ordinal as doomed_ordinal
    from public.games g join public.game_questions gq on gq.game_id=g.id
    where gq.question_id=p_question_id and g.status in ('question','results')
    order by g.created_at
  loop
    doomed:=gr.doomed_ordinal;
    update public.game_players gp
      set total_score=greatest(0,gp.total_score-coalesce(x.score,0))
      from public.game_answers x
      where gp.game_id=gr.id and x.game_id=gr.id and x.ordinal=doomed and x.user_id=gp.user_id;
    delete from public.game_answers ga where ga.game_id=gr.id and ga.ordinal=doomed;
    delete from public.game_questions gq where gq.game_id=gr.id and gq.ordinal=doomed;

    update public.game_questions gq set ordinal=gq.ordinal+1000 where gq.game_id=gr.id and gq.ordinal>doomed;
    update public.game_questions gq set ordinal=gq.ordinal-1001 where gq.game_id=gr.id and gq.ordinal>=1000;
    update public.game_answers ga set ordinal=ga.ordinal+1000 where ga.game_id=gr.id and ga.ordinal>doomed;
    update public.game_answers ga set ordinal=ga.ordinal-1001 where ga.game_id=gr.id and ga.ordinal>=1000;

    new_count:=greatest(gr.question_count-1,0);
    if gr.current_question_index>doomed then
      update public.games g set question_count=new_count,current_question_index=g.current_question_index-1 where g.id=gr.id;
    elsif gr.current_question_index=doomed then
      if new_count<=0 or doomed>=new_count then
        perform public._admin_finalize_game_after_removal(gr.id,new_count);
      else
        update public.games g set question_count=new_count,status='question',question_started_at=now(),current_question_index=doomed where g.id=gr.id;
      end if;
    else
      update public.games g set question_count=new_count where g.id=gr.id;
    end if;
    games_touched:=games_touched+1;
  end loop;

  -- Remove it from every active Practice session as well, subtracting any score
  -- already earned for the bad question and keeping ordinals contiguous.
  for pr in
    select ps.*,pq.ordinal as doomed_ordinal
    from public.practice_sessions ps join public.practice_questions pq on pq.session_id=ps.id
    where pq.question_id=p_question_id and ps.status='active' and p_practice_session_id is not null and ps.id=p_practice_session_id
    order by ps.created_at
  loop
    doomed:=pr.doomed_ordinal;
    select coalesce(pa.score,0) into removed_score from public.practice_answers pa where pa.session_id=pr.id and pa.ordinal=doomed;
    removed_score:=coalesce(removed_score,0);
    delete from public.practice_answers pa where pa.session_id=pr.id and pa.ordinal=doomed;
    delete from public.practice_questions pq where pq.session_id=pr.id and pq.ordinal=doomed;
    update public.practice_questions pq set ordinal=pq.ordinal+1000 where pq.session_id=pr.id and pq.ordinal>doomed;
    update public.practice_questions pq set ordinal=pq.ordinal-1001 where pq.session_id=pr.id and pq.ordinal>=1000;
    update public.practice_answers pa set ordinal=pa.ordinal+1000 where pa.session_id=pr.id and pa.ordinal>doomed;
    update public.practice_answers pa set ordinal=pa.ordinal-1001 where pa.session_id=pr.id and pa.ordinal>=1000;

    new_count:=greatest(pr.question_count-1,0);
    if new_count<=0 then
      update public.practice_sessions ps set question_count=1,current_index=0,total_score=greatest(0,ps.total_score-removed_score),status='completed',completed_at=now() where ps.id=pr.id;
    elsif pr.current_index>doomed then
      update public.practice_sessions ps set question_count=new_count,current_index=ps.current_index-1,total_score=greatest(0,ps.total_score-removed_score) where ps.id=pr.id;
    elsif pr.current_index=doomed and doomed>=new_count then
      update public.practice_sessions ps set question_count=new_count,current_index=greatest(new_count-1,0),total_score=greatest(0,ps.total_score-removed_score),status='completed',completed_at=now() where ps.id=pr.id;
    else
      update public.practice_sessions ps set question_count=new_count,total_score=greatest(0,ps.total_score-removed_score) where ps.id=pr.id;
    end if;
    practices_touched:=practices_touched+1;
  end loop;

  -- Existing public replays containing a retired question are hidden rather
  -- than mutated. Historical sessions remain internally coherent and auditable.
  update public.library_sessions ls set is_public=false,updated_at=now()
  where p_question_id=any(ls.question_ids) and ls.is_public;

  update public.questions q
  set is_active=false,deleted_at=now(),deleted_by=auth.uid(),delete_reason=nullif(trim(p_reason),''),updated_at=now()
  where q.id=p_question_id returning * into after_q;

  perform public._audit_question_admin(p_question_id,'delete',to_jsonb(before_q),to_jsonb(after_q),
    jsonb_build_object('reason',nullif(trim(p_reason),''),'games_touched',games_touched,'practices_touched',practices_touched));

  return jsonb_build_object('question_id',p_question_id,'deleted',true,'games_touched',games_touched,'practices_touched',practices_touched);
end $$;

revoke all on function public.admin_delete_question_v10(uuid,text,uuid) from public,anon;
grant execute on function public.admin_delete_question_v10(uuid,text,uuid) to authenticated;

create or replace function public.admin_restore_question_v10(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare before_q public.questions; after_q public.questions;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select q.* into before_q from public.questions q where q.id=p_question_id for update;
  if before_q.id is null then raise exception 'Question not found'; end if;
  update public.questions q set is_active=true,deleted_at=null,deleted_by=null,delete_reason=null,updated_at=now()
  where q.id=p_question_id returning * into after_q;
  perform public._audit_question_admin(p_question_id,'restore',to_jsonb(before_q),to_jsonb(after_q),jsonb_build_object('origin','triviaadmin'));
  return public.admin_get_question_v10(p_question_id);
end $$;

revoke all on function public.admin_restore_question_v10(uuid) from public,anon;
grant execute on function public.admin_restore_question_v10(uuid) to authenticated;

create or replace function public.admin_list_question_audit_v10(
  p_action text default null,
  p_search text default null,
  p_limit int default 100,
  p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare out_json jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  with rows as (
    select a.id,a.question_id,a.action,a.actor_user_id,a.actor_username,a.actor_email,a.before_data,a.after_data,a.metadata,a.created_at,
      coalesce(a.after_data->>'prompt',a.before_data->>'prompt','Deleted question') as prompt,
      count(*) over() total_count
    from public.question_audit_log a
    where (p_action is null or p_action='' or p_action='all' or a.action=p_action)
      and (p_search is null or trim(p_search)='' or coalesce(a.after_data->>'prompt',a.before_data->>'prompt','') ilike '%'||trim(p_search)||'%' or coalesce(a.actor_username,'') ilike '%'||trim(p_search)||'%' or coalesce(a.actor_email,'') ilike '%'||trim(p_search)||'%')
    order by a.created_at desc
    limit greatest(1,least(250,coalesce(p_limit,100))) offset greatest(0,coalesce(p_offset,0))
  )
  select jsonb_build_object('total',coalesce(max(r.total_count),0),'items',coalesce(jsonb_agg(to_jsonb(r)-'total_count'),'[]'::jsonb))
  into out_json from rows r;
  return out_json;
end $$;

revoke all on function public.admin_list_question_audit_v10(text,text,int,int) from public,anon;
grant execute on function public.admin_list_question_audit_v10(text,text,int,int) to authenticated;

commit;


-- ============================================================================
-- RECONCILE: 012_multiplayer_autoflow.sql
-- ============================================================================
-- WhatMod Trivia V11 - Automatic multiplayer flow + 1:1 match XP
-- Safe for existing V10 projects. Does not reset questions, profiles, scores,
-- history, media, or previous matches.

alter table public.games
  add column if not exists results_started_at timestamptz,
  add column if not exists rewards_awarded_at timestamptz;

alter table public.game_players
  add column if not exists xp_awarded integer not null default 0;

create or replace function public.get_lobby_v11(p_code text)
returns table(
  id uuid,
  code text,
  host_id uuid,
  title text,
  category text,
  difficulty text,
  question_count int,
  max_players int,
  game_mode text,
  seconds_per_question int,
  status text,
  current_question_index int,
  question_started_at timestamptz,
  results_started_at timestamptz,
  finished_at timestamptz,
  rewards_awarded_at timestamptz,
  player_count bigint
)
language sql
security definer
set search_path=public
as $$
  select
    g.id,g.code,g.host_id,g.title,g.category,g.difficulty,g.question_count,
    g.max_players,g.game_mode,g.seconds_per_question,g.status,g.current_question_index,
    g.question_started_at,g.results_started_at,g.finished_at,g.rewards_awarded_at,
    (select count(*) from public.game_players p where p.game_id=g.id)
  from public.games g
  where g.code=upper(trim(p_code))
    and (
      g.status='lobby'
      or g.host_id=auth.uid()
      or exists(
        select 1 from public.game_players p
        where p.game_id=g.id and p.user_id=auth.uid()
      )
    );
$$;

revoke all on function public.get_lobby_v11(text) from public;
grant execute on function public.get_lobby_v11(text) to anon,authenticated;

create or replace function public.get_round_results_v11(p_game_id uuid)
returns table(
  user_id uuid,
  username text,
  avatar_url text,
  answer_numeric numeric,
  answer_value text,
  score int,
  total_score int,
  xp_awarded int,
  is_me boolean
)
language sql
security definer
set search_path=public
as $$
  select
    gp.user_id,
    pr.username,
    pr.avatar_url,
    ga.answer_numeric,
    ga.answer_value,
    coalesce(ga.score,0)::int,
    gp.total_score,
    gp.xp_awarded,
    (gp.user_id=auth.uid())
  from public.games g
  join public.game_players gp on gp.game_id=g.id
  join public.profiles pr on pr.user_id=gp.user_id
  left join public.game_answers ga
    on ga.game_id=g.id
   and ga.ordinal=g.current_question_index
   and ga.user_id=gp.user_id
  where g.id=p_game_id
    and g.status in('results','finished')
    and exists(
      select 1 from public.game_players me
      where me.game_id=g.id and me.user_id=auth.uid()
    )
  order by gp.total_score desc,coalesce(ga.score,0) desc,gp.joined_at asc;
$$;

revoke all on function public.get_round_results_v11(uuid) from public,anon;
grant execute on function public.get_round_results_v11(uuid) to authenticated;

create or replace function public._finalize_game_v11(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  g_rec public.games;
  winner_id uuid;
begin
  select g.* into g_rec
  from public.games g
  where g.id=p_game_id
  for update;

  if g_rec.id is null then return; end if;

  if g_rec.rewards_awarded_at is null then
    select gp.user_id into winner_id
    from public.game_players gp
    where gp.game_id=p_game_id
    order by gp.total_score desc,gp.joined_at asc
    limit 1;

    update public.game_players gp
    set xp_awarded=greatest(0,gp.total_score)
    where gp.game_id=p_game_id;

    update public.profiles pr
    set
      games_played=pr.games_played+1,
      wins=pr.wins + case when pr.user_id=winner_id then 1 else 0 end,
      xp=pr.xp + coalesce((
        select greatest(0,gp.total_score)
        from public.game_players gp
        where gp.game_id=p_game_id and gp.user_id=pr.user_id
      ),0)
    where exists(
      select 1 from public.game_players gp
      where gp.game_id=p_game_id and gp.user_id=pr.user_id
    );

    update public.games g
    set rewards_awarded_at=now()
    where g.id=p_game_id and g.rewards_awarded_at is null;
  end if;

  update public.games g
  set
    status='finished',
    finished_at=coalesce(g.finished_at,now())
  where g.id=p_game_id;
end $$;

revoke all on function public._finalize_game_v11(uuid) from public,anon,authenticated;

create or replace function public.submit_game_answer(
  p_game_id uuid,
  p_answer text,
  p_response_ms int default 0
)
returns table(score int,total_score int)
language plpgsql
security definer
set search_path=public
as $$
declare
  g_rec public.games;
  q_rec public.questions;
  p_points int;
  p_numeric_answer numeric;
  p_inserted int;
  p_total int;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;

  select g.* into g_rec
  from public.games g
  where g.id=p_game_id
  for update;

  if g_rec.id is null then raise exception 'Game not found'; end if;
  if g_rec.status<>'question' then raise exception 'Answers are closed'; end if;
  if not exists(
    select 1 from public.game_players gp
    where gp.game_id=p_game_id and gp.user_id=auth.uid()
  ) then raise exception 'Not in game'; end if;
  if g_rec.question_started_at is null then raise exception 'Question has not started'; end if;

  if now() >= g_rec.question_started_at + make_interval(secs=>g_rec.seconds_per_question) then
    raise exception 'Time expired';
  end if;

  select q.* into q_rec
  from public.game_questions gq
  join public.questions q on q.id=gq.question_id
  where gq.game_id=g_rec.id and gq.ordinal=g_rec.current_question_index;

  if q_rec.id is null then raise exception 'Question not found'; end if;

  p_points:=public.score_answer(q_rec,p_answer);

  if q_rec.question_type='numeric' then
    begin
      p_numeric_answer:=p_answer::numeric;
    exception when others then
      p_numeric_answer:=null;
    end;
  end if;

  insert into public.game_answers(
    game_id,ordinal,user_id,answer_value,answer_numeric,score,response_ms
  )
  values(
    g_rec.id,g_rec.current_question_index,auth.uid(),left(p_answer,200),
    p_numeric_answer,p_points,greatest(0,coalesce(p_response_ms,0))
  )
  on conflict(game_id,ordinal,user_id) do nothing;

  get diagnostics p_inserted=row_count;

  if p_inserted=1 then
    update public.game_players gp
    set total_score=gp.total_score+p_points
    where gp.game_id=g_rec.id and gp.user_id=auth.uid()
    returning gp.total_score into p_total;
  else
    select gp.total_score into p_total
    from public.game_players gp
    where gp.game_id=g_rec.id and gp.user_id=auth.uid();
  end if;

  return query select p_points,coalesce(p_total,0);
end $$;

revoke all on function public.submit_game_answer(uuid,text,int) from public,anon;
grant execute on function public.submit_game_answer(uuid,text,int) to authenticated;

create or replace function public.reveal_round(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare g_rec public.games;
begin
  select g.* into g_rec
  from public.games g
  where g.id=p_game_id
  for update;

  if g_rec.id is null then raise exception 'Game not found'; end if;
  if g_rec.host_id<>auth.uid() then raise exception 'Host only'; end if;

  if g_rec.status='question' then
    update public.games g
    set status='results',results_started_at=now()
    where g.id=p_game_id;
  elsif g_rec.status in('results','finished') then
    return;
  else
    raise exception 'Game is not in an active round';
  end if;
end $$;

revoke all on function public.reveal_round(uuid) from public,anon;
grant execute on function public.reveal_round(uuid) to authenticated;

create or replace function public.next_round(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare g_rec public.games;
begin
  select g.* into g_rec
  from public.games g
  where g.id=p_game_id
  for update;

  if g_rec.id is null then raise exception 'Game not found'; end if;
  if g_rec.host_id<>auth.uid() then raise exception 'Host only'; end if;

  if g_rec.status='finished' then return; end if;
  if g_rec.status<>'results' then raise exception 'Reveal the current round first'; end if;

  if g_rec.current_question_index+1>=g_rec.question_count then
    perform public._finalize_game_v11(p_game_id);
  else
    update public.games g
    set
      current_question_index=g.current_question_index+1,
      status='question',
      question_started_at=now(),
      results_started_at=null
    where g.id=p_game_id;
  end if;
end $$;

revoke all on function public.next_round(uuid) from public,anon;
grant execute on function public.next_round(uuid) to authenticated;

create or replace function public.sync_game_clock_v11(p_game_id uuid)
returns table(
  status text,
  current_question_index int,
  question_count int,
  question_started_at timestamptz,
  results_started_at timestamptz,
  finished_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
declare
  g_rec public.games;
  deadline timestamptz;
  reveal_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;

  select g.* into g_rec
  from public.games g
  where g.id=p_game_id
  for update;

  if g_rec.id is null then raise exception 'Game not found'; end if;

  if not exists(
    select 1 from public.game_players gp
    where gp.game_id=p_game_id and gp.user_id=auth.uid()
  ) then raise exception 'Not in game'; end if;

  if g_rec.status='question' and g_rec.question_started_at is not null then
    deadline:=g_rec.question_started_at + make_interval(secs=>g_rec.seconds_per_question);

    if now() >= deadline then
      update public.games g
      set
        status='results',
        results_started_at=coalesce(g.results_started_at,deadline)
      where g.id=p_game_id;

      select g.* into g_rec
      from public.games g
      where g.id=p_game_id;
    end if;
  end if;

  if g_rec.status='results' then
    reveal_at:=coalesce(g_rec.results_started_at,now());

    if g_rec.results_started_at is null then
      update public.games g
      set results_started_at=reveal_at
      where g.id=p_game_id;
      g_rec.results_started_at:=reveal_at;
    end if;

    if now() >= reveal_at + interval '5 seconds' then
      if g_rec.current_question_index+1>=g_rec.question_count then
        perform public._finalize_game_v11(p_game_id);
      else
        update public.games g
        set
          current_question_index=g.current_question_index+1,
          status='question',
          question_started_at=now(),
          results_started_at=null
        where g.id=p_game_id;
      end if;

      select g.* into g_rec
      from public.games g
      where g.id=p_game_id;
    end if;
  end if;

  return query
  select
    g_rec.status,
    g_rec.current_question_index,
    g_rec.question_count,
    g_rec.question_started_at,
    g_rec.results_started_at,
    g_rec.finished_at;
end $$;

revoke all on function public.sync_game_clock_v11(uuid) from public,anon;
grant execute on function public.sync_game_clock_v11(uuid) to authenticated;

create or replace function public._admin_finalize_game_after_removal(p_game_id uuid,p_rounds int)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare rounds int:=greatest(coalesce(p_rounds,0),0);
begin
  update public.games g
  set
    question_count=greatest(rounds,1),
    current_question_index=greatest(rounds-1,0),
    status=case when g.status='finished' then g.status else 'results' end,
    results_started_at=coalesce(g.results_started_at,now())
  where g.id=p_game_id;

  perform public._finalize_game_v11(p_game_id);
end $$;

revoke all on function public._admin_finalize_game_after_removal(uuid,int) from public,anon,authenticated;

-- Expected-index host overrides prevent stale buttons from affecting a newer round.
create or replace function public.reveal_round_v11(p_game_id uuid,p_expected_index int)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare g_rec public.games;
begin
  select g.* into g_rec from public.games g where g.id=p_game_id for update;
  if g_rec.id is null then raise exception 'Game not found'; end if;
  if g_rec.host_id<>auth.uid() then raise exception 'Host only'; end if;

  if g_rec.status='finished' or g_rec.current_question_index<>p_expected_index then return; end if;
  if g_rec.status='results' then return; end if;
  if g_rec.status<>'question' then raise exception 'Game is not in an active round'; end if;

  update public.games g
  set status='results',results_started_at=now()
  where g.id=p_game_id and g.current_question_index=p_expected_index and g.status='question';
end $$;

revoke all on function public.reveal_round_v11(uuid,int) from public,anon;
grant execute on function public.reveal_round_v11(uuid,int) to authenticated;

create or replace function public.advance_round_v11(p_game_id uuid,p_expected_index int)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare g_rec public.games;
begin
  select g.* into g_rec from public.games g where g.id=p_game_id for update;
  if g_rec.id is null then raise exception 'Game not found'; end if;
  if g_rec.host_id<>auth.uid() then raise exception 'Host only'; end if;

  if g_rec.status='finished' or g_rec.current_question_index<>p_expected_index then return; end if;
  if g_rec.status<>'results' then raise exception 'Results are not ready yet'; end if;

  if g_rec.current_question_index+1>=g_rec.question_count then
    perform public._finalize_game_v11(p_game_id);
  else
    update public.games g
    set current_question_index=g.current_question_index+1,
        status='question',question_started_at=now(),results_started_at=null
    where g.id=p_game_id and g.current_question_index=p_expected_index;
  end if;
end $$;

revoke all on function public.advance_round_v11(uuid,int) from public,anon;
grant execute on function public.advance_round_v11(uuid,int) to authenticated;


-- ============================================================================
-- RECONCILE: 013_local_content_studio.sql
-- ============================================================================
-- WhatMod Trivia V12
-- Local Content Studio: question hydration + media in one admin-imported package.
-- Safe to run after 012_multiplayer_autoflow.sql.

begin;

alter table public.questions add column if not exists content_locked boolean not null default false;

-- Manual questions are admin-owned content and should never be overwritten by automated hydration.
update public.questions q
set content_locked=true
where coalesce(q.source_type,'manual')='manual' and not q.content_locked;

-- Replace manual-create function so new admin-authored questions are content locked.
create or replace function public.admin_create_question_v10(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare q public.questions; qtype text; opts jsonb; correct int; numeric_ans numeric; text_ans text;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  qtype:=coalesce(nullif(p_payload->>'question_type',''),'numeric');
  if qtype not in ('numeric','multiple_choice','text') then raise exception 'Invalid question type'; end if;
  if coalesce(length(trim(p_payload->>'prompt')),0)<4 then raise exception 'Question prompt is required'; end if;
  if coalesce(p_payload->>'difficulty','') not in ('easy','medium','hard') then raise exception 'Invalid difficulty'; end if;

  if qtype='numeric' then
    numeric_ans:=nullif(p_payload->>'answer_numeric','')::numeric;
    if numeric_ans is null then raise exception 'Numeric answer is required'; end if;
  elsif qtype='text' then
    text_ans:=nullif(trim(p_payload->>'answer_text'),'');
    if text_ans is null then raise exception 'Text answer is required'; end if;
  else
    opts:=p_payload->'options';
    correct:=nullif(p_payload->>'correct_option','')::int;
    if jsonb_typeof(opts)<>'array' or jsonb_array_length(opts)<2 then raise exception 'At least two answer options are required'; end if;
    if correct is null or correct<0 or correct>=jsonb_array_length(opts) then raise exception 'Correct option is invalid'; end if;
  end if;

  insert into public.questions(
    category,difficulty,question_type,prompt,context,unit,options,answer_numeric,answer_text,correct_option,
    explanation,source_url,is_active,created_by,source_type,media_query,updated_at,content_locked
  ) values(
    coalesce(nullif(trim(p_payload->>'category'),''),'General'),p_payload->>'difficulty',qtype,trim(p_payload->>'prompt'),
    nullif(trim(p_payload->>'context'),''),nullif(trim(p_payload->>'unit'),''),
    case when qtype='multiple_choice' then opts else null end,
    case when qtype='numeric' then numeric_ans else null end,
    case when qtype='text' then text_ans else null end,
    case when qtype='multiple_choice' then correct else null end,
    nullif(trim(p_payload->>'explanation'),''),nullif(trim(p_payload->>'source_url'),''),true,auth.uid(),'manual',
    nullif(trim(p_payload->>'media_query'),''),now(),true
  ) returning * into q;

  perform public._audit_question_admin(q.id,'create',null,to_jsonb(q),jsonb_build_object('origin','triviaadmin','content_locked',true));
  return public.admin_get_question_v10(q.id);
end $$;

-- Any manual admin edit becomes authoritative and protects the question from future hydrator factual overwrites.
create or replace function public.admin_update_question_v10(p_question_id uuid,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare before_q public.questions; after_q public.questions; qtype text; opts jsonb; correct int; numeric_ans numeric; text_ans text;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select q.* into before_q from public.questions q where q.id=p_question_id for update;
  if before_q.id is null then raise exception 'Question not found'; end if;

  qtype:=coalesce(nullif(p_payload->>'question_type',''),before_q.question_type);
  if qtype not in ('numeric','multiple_choice','text') then raise exception 'Invalid question type'; end if;

  if qtype='numeric' then
    numeric_ans:=coalesce(nullif(p_payload->>'answer_numeric','')::numeric,before_q.answer_numeric);
    if numeric_ans is null then raise exception 'Numeric answer is required'; end if;
  elsif qtype='text' then
    text_ans:=coalesce(nullif(trim(p_payload->>'answer_text'),''),before_q.answer_text);
    if text_ans is null then raise exception 'Text answer is required'; end if;
  else
    opts:=coalesce(p_payload->'options',before_q.options);
    correct:=coalesce(nullif(p_payload->>'correct_option','')::int,before_q.correct_option);
    if jsonb_typeof(opts)<>'array' or jsonb_array_length(opts)<2 then raise exception 'At least two answer options are required'; end if;
    if correct is null or correct<0 or correct>=jsonb_array_length(opts) then raise exception 'Correct option is invalid'; end if;
  end if;

  update public.questions q set
    category=coalesce(nullif(trim(p_payload->>'category'),''),q.category),
    difficulty=case when p_payload ? 'difficulty' then p_payload->>'difficulty' else q.difficulty end,
    question_type=qtype,
    prompt=coalesce(nullif(trim(p_payload->>'prompt'),''),q.prompt),
    context=case when p_payload ? 'context' then nullif(trim(p_payload->>'context'),'') else q.context end,
    unit=case when p_payload ? 'unit' then nullif(trim(p_payload->>'unit'),'') else q.unit end,
    options=case when qtype='multiple_choice' then opts else null end,
    answer_numeric=case when qtype='numeric' then numeric_ans else null end,
    answer_text=case when qtype='text' then text_ans else null end,
    correct_option=case when qtype='multiple_choice' then correct else null end,
    explanation=case when p_payload ? 'explanation' then nullif(trim(p_payload->>'explanation'),'') else q.explanation end,
    source_url=case when p_payload ? 'source_url' then nullif(trim(p_payload->>'source_url'),'') else q.source_url end,
    media_query=case when p_payload ? 'media_query' then nullif(trim(p_payload->>'media_query'),'') else q.media_query end,
    content_locked=true,
    updated_at=now()
  where q.id=p_question_id returning * into after_q;

  if after_q.difficulty not in ('easy','medium','hard') then raise exception 'Invalid difficulty'; end if;
  perform public._audit_question_admin(p_question_id,'edit',to_jsonb(before_q),to_jsonb(after_q),jsonb_build_object('origin','triviaadmin','content_locked',true));
  return public.admin_get_question_v10(p_question_id);
end $$;

-- One chunk of a V12 content package. The browser splits one uploaded package into chunks
-- to avoid oversized HTTP/RPC payloads, but the user still performs one upload action.
create or replace function public.admin_import_content_package_v12(
  p_questions jsonb,
  p_package_id text default null,
  p_auto_publish boolean default true,
  p_preserve_content_locked boolean default true,
  p_preserve_media_locked boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  item jsonb;
  media jsonb;
  cand jsonb;
  before_q public.questions;
  after_q public.questions;
  qid uuid;
  canonical text;
  qtype text;
  opts jsonb;
  selected_provider text;
  selected_key text;
  selected_manual boolean;
  selected_candidate public.question_media_candidates;
  cid uuid;
  incoming_core jsonb;
  existing_core jsonb;
  created_count int:=0;
  updated_count int:=0;
  unchanged_count int:=0;
  content_locked_count int:=0;
  retired_count int:=0;
  media_locked_count int:=0;
  imported_candidates int:=0;
  published_media int:=0;
  invalid_count int:=0;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  if jsonb_typeof(coalesce(p_questions,'[]'::jsonb))<>'array' then raise exception 'p_questions must be an array'; end if;

  for item in select value from jsonb_array_elements(coalesce(p_questions,'[]'::jsonb))
  loop
    canonical:=nullif(trim(item->>'canonical_key'),'');
    if canonical is null then invalid_count:=invalid_count+1; continue; end if;

    qtype:=coalesce(nullif(trim(item->>'question_type'),''),'numeric');
    if qtype not in ('numeric','multiple_choice','text') then invalid_count:=invalid_count+1; continue; end if;
    if coalesce(length(trim(item->>'prompt')),0)<4 then invalid_count:=invalid_count+1; continue; end if;
    if coalesce(item->>'difficulty','') not in ('easy','medium','hard') then invalid_count:=invalid_count+1; continue; end if;

    select q.* into before_q from public.questions q where q.canonical_key=canonical for update;

    if before_q.id is null then
      opts:=case when jsonb_typeof(item->'options')='array' then item->'options' else null end;
      insert into public.questions(
        category,difficulty,question_type,prompt,context,unit,options,answer_numeric,answer_text,correct_option,
        explanation,source_url,is_active,source_type,source_entity_id,canonical_key,media_query,updated_at,content_locked
      ) values(
        coalesce(nullif(trim(item->>'category'),''),'General'),item->>'difficulty',qtype,trim(item->>'prompt'),
        nullif(trim(coalesce(item->>'context','')),''),nullif(trim(coalesce(item->>'unit','')),''),
        case when qtype='multiple_choice' then opts else null end,
        case when qtype='numeric' and coalesce(item->>'answer_numeric','') ~ '^-?[0-9]+([.][0-9]+)?$' then (item->>'answer_numeric')::numeric else null end,
        case when qtype='text' then nullif(trim(coalesce(item->>'answer_text','')),'') else null end,
        case when qtype='multiple_choice' and coalesce(item->>'correct_option','') ~ '^[0-9]+$' then (item->>'correct_option')::int else null end,
        nullif(trim(coalesce(item->>'explanation','')),''),nullif(trim(coalesce(item->>'source_url','')),''),true,
        coalesce(nullif(trim(item->>'source_type'),''),'local_content_studio'),
        nullif(trim(coalesce(item->>'source_entity_id','')),''),canonical,
        nullif(trim(coalesce(item->>'media_query','')),''),now(),false
      ) returning * into after_q;

      -- Validate the required answer shape after insert values are normalized.
      if (qtype='numeric' and after_q.answer_numeric is null)
         or (qtype='text' and after_q.answer_text is null)
         or (qtype='multiple_choice' and (after_q.options is null or after_q.correct_option is null)) then
        raise exception 'Invalid answer payload for %',canonical;
      end if;

      qid:=after_q.id;
      created_count:=created_count+1;
      perform public._audit_question_admin(qid,'create',null,to_jsonb(after_q),jsonb_build_object(
        'origin','local_content_studio','package_id',p_package_id,'canonical_key',canonical
      ));
    else
      qid:=before_q.id;
      if not before_q.is_active then
        retired_count:=retired_count+1;
      elsif coalesce(p_preserve_content_locked,true) and before_q.content_locked then
        content_locked_count:=content_locked_count+1;
      else
        opts:=case when jsonb_typeof(item->'options')='array' then item->'options' else null end;
        incoming_core:=jsonb_build_object(
          'category',coalesce(nullif(trim(item->>'category'),''),before_q.category),
          'difficulty',item->>'difficulty','question_type',qtype,'prompt',trim(item->>'prompt'),
          'context',nullif(trim(coalesce(item->>'context','')),''),'unit',nullif(trim(coalesce(item->>'unit','')),''),
          'options',case when qtype='multiple_choice' then opts else null end,
          'answer_numeric',case when qtype='numeric' and coalesce(item->>'answer_numeric','') ~ '^-?[0-9]+([.][0-9]+)?$' then to_jsonb((item->>'answer_numeric')::numeric) else 'null'::jsonb end,
          'answer_text',case when qtype='text' then to_jsonb(nullif(trim(coalesce(item->>'answer_text','')),'')) else 'null'::jsonb end,
          'correct_option',case when qtype='multiple_choice' and coalesce(item->>'correct_option','') ~ '^[0-9]+$' then to_jsonb((item->>'correct_option')::int) else 'null'::jsonb end,
          'explanation',nullif(trim(coalesce(item->>'explanation','')),''),'source_url',nullif(trim(coalesce(item->>'source_url','')),''),
          'source_type',coalesce(nullif(trim(item->>'source_type'),''),before_q.source_type),
          'source_entity_id',coalesce(nullif(trim(item->>'source_entity_id'),''),before_q.source_entity_id),
          'media_query',coalesce(nullif(trim(item->>'media_query'),''),before_q.media_query)
        );
        existing_core:=jsonb_build_object(
          'category',before_q.category,'difficulty',before_q.difficulty,'question_type',before_q.question_type,'prompt',before_q.prompt,
          'context',before_q.context,'unit',before_q.unit,'options',before_q.options,'answer_numeric',before_q.answer_numeric,
          'answer_text',before_q.answer_text,'correct_option',before_q.correct_option,'explanation',before_q.explanation,
          'source_url',before_q.source_url,'source_type',before_q.source_type,'source_entity_id',before_q.source_entity_id,'media_query',before_q.media_query
        );

        if existing_core= incoming_core then
          after_q:=before_q;
          unchanged_count:=unchanged_count+1;
        else
          update public.questions q set
            category=coalesce(nullif(trim(item->>'category'),''),q.category),difficulty=item->>'difficulty',question_type=qtype,prompt=trim(item->>'prompt'),
            context=nullif(trim(coalesce(item->>'context','')),''),unit=nullif(trim(coalesce(item->>'unit','')),''),
            options=case when qtype='multiple_choice' then opts else null end,
            answer_numeric=case when qtype='numeric' and coalesce(item->>'answer_numeric','') ~ '^-?[0-9]+([.][0-9]+)?$' then (item->>'answer_numeric')::numeric else null end,
            answer_text=case when qtype='text' then nullif(trim(coalesce(item->>'answer_text','')),'') else null end,
            correct_option=case when qtype='multiple_choice' and coalesce(item->>'correct_option','') ~ '^[0-9]+$' then (item->>'correct_option')::int else null end,
            explanation=nullif(trim(coalesce(item->>'explanation','')),''),source_url=nullif(trim(coalesce(item->>'source_url','')),''),
            source_type=coalesce(nullif(trim(item->>'source_type'),''),q.source_type),source_entity_id=coalesce(nullif(trim(item->>'source_entity_id'),''),q.source_entity_id),
            media_query=coalesce(nullif(trim(item->>'media_query'),''),q.media_query),updated_at=now()
          where q.id=qid returning * into after_q;
          updated_count:=updated_count+1;
          perform public._audit_question_admin(qid,'edit',to_jsonb(before_q),to_jsonb(after_q),jsonb_build_object(
            'origin','local_content_studio','package_id',p_package_id,'canonical_key',canonical,'automated_sync',true
          ));
        end if;
      end if;
    end if;

    -- Media is imported even if factual content is protected, unless the media itself is locked.
    select q.* into after_q from public.questions q where q.id=qid;
    media:=coalesce(item->'media','{}'::jsonb);
    if after_q.media_locked and coalesce(p_preserve_media_locked,true) then
      media_locked_count:=media_locked_count+1;
      continue;
    end if;

    if nullif(trim(media->>'query'),'') is not null then
      update public.questions q set media_query=left(trim(media->>'query'),500) where q.id=qid;
    elsif nullif(trim(item->>'media_query'),'') is not null then
      update public.questions q set media_query=left(trim(item->>'media_query'),500) where q.id=qid;
    end if;

    if jsonb_typeof(media->'candidates')='array' then
      for cand in select value from jsonb_array_elements(media->'candidates')
      loop
        if nullif(trim(cand->>'provider'),'') is null
           or nullif(trim(cand->>'provider_key'),'') is null
           or nullif(trim(cand->>'image_url'),'') is null then continue; end if;

        insert into public.question_media_candidates(
          question_id,provider,provider_key,title,image_url,thumbnail_url,source_url,creator,creator_url,
          license,license_url,width,height,score,auto_eligible,is_available,status,metadata,updated_at,last_checked_at
        ) values(
          qid,left(trim(cand->>'provider'),60),left(trim(cand->>'provider_key'),240),nullif(left(trim(coalesce(cand->>'title','')),500),''),
          trim(cand->>'image_url'),nullif(trim(coalesce(cand->>'thumbnail_url','')),''),nullif(trim(coalesce(cand->>'source_url','')),''),
          nullif(left(trim(coalesce(cand->>'creator','')),500),''),nullif(trim(coalesce(cand->>'creator_url','')),''),
          nullif(left(trim(coalesce(cand->>'license','')),200),''),nullif(trim(coalesce(cand->>'license_url','')),''),
          case when coalesce(cand->>'width','') ~ '^[0-9]+$' then (cand->>'width')::int else null end,
          case when coalesce(cand->>'height','') ~ '^[0-9]+$' then (cand->>'height')::int else null end,
          case when coalesce(cand->>'score','') ~ '^-?[0-9]+([.][0-9]+)?$' then (cand->>'score')::numeric else 0 end,
          coalesce((cand->>'auto_eligible')::boolean,false),coalesce((cand->>'is_available')::boolean,false),'candidate',
          coalesce(cand->'metadata','{}'::jsonb),now(),now()
        )
        on conflict(question_id,provider,provider_key) do update set
          title=excluded.title,image_url=excluded.image_url,thumbnail_url=excluded.thumbnail_url,source_url=excluded.source_url,
          creator=excluded.creator,creator_url=excluded.creator_url,license=excluded.license,license_url=excluded.license_url,
          width=excluded.width,height=excluded.height,score=excluded.score,auto_eligible=excluded.auto_eligible,
          is_available=excluded.is_available,metadata=excluded.metadata,
          status=case when public.question_media_candidates.status='rejected' then 'rejected' else 'candidate' end,
          updated_at=now(),last_checked_at=now()
        returning id into cid;
        imported_candidates:=imported_candidates+1;
      end loop;
    end if;

    selected_provider:=nullif(trim(media#>>'{selected,provider}'),'');
    selected_key:=nullif(trim(media#>>'{selected,provider_key}'),'');
    selected_manual:=lower(coalesce(media->>'selection_mode','auto'))='manual';

    if selected_provider is not null and selected_key is not null then
      select c.* into selected_candidate from public.question_media_candidates c
      where c.question_id=qid and c.provider=selected_provider and c.provider_key=selected_key
        and c.status<>'rejected' and c.is_available=true limit 1;

      if selected_candidate.id is not null and coalesce(p_auto_publish,true)
         and (selected_candidate.auto_eligible or selected_manual) then
        update public.question_media_candidates c set
          status=case when c.id=selected_candidate.id then 'auto_selected' when c.status in ('selected','auto_selected') then 'candidate' else c.status end,
          updated_at=now()
        where c.question_id=qid and c.status<>'rejected';

        update public.questions q set
          image_url=coalesce(nullif(selected_candidate.thumbnail_url,''),selected_candidate.image_url),
          image_alt=coalesce(nullif(selected_candidate.title,''),q.media_query,q.image_alt,q.prompt),
          image_source_url=selected_candidate.source_url,image_attribution=selected_candidate.creator,
          image_license=selected_candidate.license,image_license_url=selected_candidate.license_url,
          media_provider=selected_candidate.provider,media_candidate_id=selected_candidate.id,
          media_review_status='auto',media_locked=false,media_updated_at=now(),media_last_resolved_at=now()
        where q.id=qid;
        published_media:=published_media+1;
      else
        update public.questions q set media_last_resolved_at=now(),media_updated_at=now() where q.id=qid;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'created',created_count,'updated',updated_count,'unchanged',unchanged_count,
    'content_locked',content_locked_count,'retired',retired_count,'media_locked',media_locked_count,
    'imported_candidates',imported_candidates,'published_media',published_media,'invalid',invalid_count
  );
end $$;

revoke all on function public.admin_create_question_v10(jsonb) from public,anon;
grant execute on function public.admin_create_question_v10(jsonb) to authenticated;
revoke all on function public.admin_update_question_v10(uuid,jsonb) from public,anon;
grant execute on function public.admin_update_question_v10(uuid,jsonb) to authenticated;

revoke all on function public.admin_import_content_package_v12(jsonb,text,boolean,boolean,boolean) from public,anon;
grant execute on function public.admin_import_content_package_v12(jsonb,text,boolean,boolean,boolean) to authenticated;

commit;
-- WhatMod Trivia V14.2 - matchmaking + complete-query hotfix

-- V14.1 prerequisite repair: make matchmaking migration safe even when older
-- multiplayer/library migrations were skipped or only partially applied.
alter table public.games
  add column if not exists results_started_at timestamptz,
  add column if not exists rewards_awarded_at timestamptz,
  add column if not exists library_session_id uuid;

alter table public.game_players
  add column if not exists xp_awarded integer not null default 0;

alter table public.games
  add column if not exists visibility text not null default 'invite_only' check (visibility in ('public','invite_only')),
  add column if not exists allow_matchmaking boolean not null default false,
  add column if not exists lobby_kind text not null default 'custom' check (lobby_kind in ('custom','matchmaking')),
  add column if not exists matchmaking_target integer not null default 10 check (matchmaking_target between 2 and 50),
  add column if not exists cycle_no integer not null default 1;

alter table public.game_players
  add column if not exists participation_status text not null default 'active' check (participation_status in ('active','spectator')),
  add column if not exists joined_cycle integer not null default 1;

alter table public.profiles alter column ui_theme set default 'v2';
update public.profiles set ui_theme='v2' where ui_theme is null;

create table if not exists public.game_bots (
  game_id uuid not null references public.games(id) on delete cascade,
  bot_id uuid not null default gen_random_uuid(),
  username text not null,
  skill numeric not null default .55 check (skill between 0 and 1),
  total_score integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (game_id,bot_id)
);

create table if not exists public.game_bot_answers (
  game_id uuid not null references public.games(id) on delete cascade,
  ordinal integer not null,
  bot_id uuid not null,
  answer_value text,
  answer_numeric numeric,
  score integer not null default 0 check (score between 0 and 1000),
  primary key (game_id,ordinal,bot_id),
  foreign key (game_id,bot_id) references public.game_bots(game_id,bot_id) on delete cascade
);

alter table public.game_bots enable row level security;
alter table public.game_bot_answers enable row level security;
revoke all on public.game_bots, public.game_bot_answers from anon,authenticated;

create or replace function public._seed_matchmaking_bots_v14(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare g_rec public.games; humans int; needed int; names text[]:=array['Nova','Quasar','Pixel','Atlas','Echo','Moxie','Orbit','Vega','Scout','Juno','Comet','Rook','Ziggy','Pico','Ember']; i int;
begin
  select g.* into g_rec from public.games g where g.id=p_game_id for update;
  if g_rec.id is null or g_rec.lobby_kind<>'matchmaking' then return; end if;
  delete from public.game_bots where game_id=p_game_id;
  select count(*) into humans from public.game_players gp where gp.game_id=p_game_id and gp.participation_status='active';
  needed:=greatest(0,least(g_rec.matchmaking_target,g_rec.max_players)-humans);
  for i in 1..needed loop
    insert into public.game_bots(game_id,username,skill)
    values(p_game_id,names[1+((i-1)%array_length(names,1))] || case when i>array_length(names,1) then ' '||i else '' end,
           least(.9,greatest(.32,.42 + random()*.42)));
  end loop;
end $$;
revoke all on function public._seed_matchmaking_bots_v14(uuid) from public,anon,authenticated;

create or replace function public._start_game_v14(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare g_rec public.games; available int;
begin
  select g.* into g_rec from public.games g where g.id=p_game_id for update;
  if g_rec.id is null then raise exception 'Game not found'; end if;
  if g_rec.status<>'lobby' then return; end if;

  update public.game_players gp set participation_status='active',total_score=0,xp_awarded=0 where gp.game_id=p_game_id;
  delete from public.game_answers where game_id=p_game_id;
  delete from public.game_bot_answers where game_id=p_game_id;
  delete from public.game_questions where game_id=p_game_id;
  delete from public.game_bots where game_id=p_game_id;

  select count(*) into available from public.questions q where q.is_active
    and (g_rec.category='Any' or q.category=g_rec.category)
    and (g_rec.difficulty='any' or q.difficulty=g_rec.difficulty);
  if available<g_rec.question_count then raise exception 'Not enough matching questions in the bank (% available)',available; end if;

  insert into public.game_questions(game_id,ordinal,question_id)
  select g_rec.id,row_number() over()-1,id from (
    select q.id from public.questions q where q.is_active
      and (g_rec.category='Any' or q.category=g_rec.category)
      and (g_rec.difficulty='any' or q.difficulty=g_rec.difficulty)
    order by random() limit g_rec.question_count
  ) picked;

  perform public._seed_matchmaking_bots_v14(p_game_id);
  update public.games g set status='question',current_question_index=0,question_started_at=now(),results_started_at=null,
    finished_at=null,rewards_awarded_at=null,library_session_id=null where g.id=p_game_id;
end $$;
revoke all on function public._start_game_v14(uuid) from public,anon,authenticated;

create or replace function public.create_lobby_v14(
  p_category text default 'Any', p_difficulty text default 'any', p_question_count int default 10,
  p_max_players int default 10, p_game_mode text default 'standard', p_seconds_per_question int default 20,
  p_title text default null, p_visibility text default 'invite_only', p_allow_matchmaking boolean default false
) returns table(id uuid,code text) language plpgsql security definer set search_path=public as $$
declare c text; tries int:=0; gid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_visibility not in ('public','invite_only') then raise exception 'Invalid lobby visibility'; end if;
  if p_max_players<2 or p_max_players>20000 then raise exception 'Invalid player limit'; end if;
  loop c:=public.make_code(); tries:=tries+1; exit when not exists(select 1 from public.games where games.code=c); if tries>20 then raise exception 'Could not allocate lobby code'; end if; end loop;
  insert into public.games(code,host_id,title,category,difficulty,question_count,max_players,game_mode,seconds_per_question,visibility,allow_matchmaking,lobby_kind,matchmaking_target)
  values(c,auth.uid(),nullif(trim(p_title),''),coalesce(p_category,'Any'),coalesce(p_difficulty,'any'),greatest(1,least(50,p_question_count)),p_max_players,
         case when p_game_mode in ('standard','event') then p_game_mode else 'standard' end,greatest(5,least(120,p_seconds_per_question)),p_visibility,
         case when p_visibility='public' then coalesce(p_allow_matchmaking,false) else false end,'custom',least(10,p_max_players)) returning games.id into gid;
  insert into public.game_players(game_id,user_id,participation_status,joined_cycle) values(gid,auth.uid(),'active',1);
  return query select gid,c;
end $$;
revoke all on function public.create_lobby_v14(text,text,int,int,text,int,text,text,boolean) from public,anon;
grant execute on function public.create_lobby_v14(text,text,int,int,text,int,text,text,boolean) to authenticated;

create or replace function public.join_lobby_v14(p_code text)
returns table(code text,join_mode text) language plpgsql security definer set search_path=public as $$
declare g_rec public.games; humans int; role text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select g.* into g_rec from public.games g where g.code=upper(trim(p_code)) for update;
  if g_rec.id is null then raise exception 'Lobby not found'; end if;
  if g_rec.status='cancelled' then raise exception 'Lobby is closed'; end if;
  select count(*) into humans from public.game_players gp where gp.game_id=g_rec.id;
  if humans>=g_rec.max_players and not exists(select 1 from public.game_players gp where gp.game_id=g_rec.id and gp.user_id=auth.uid()) then raise exception 'Lobby is full'; end if;
  role:=case when g_rec.status='lobby' then 'active' else 'spectator' end;
  insert into public.game_players(game_id,user_id,participation_status,joined_cycle)
  values(g_rec.id,auth.uid(),role,g_rec.cycle_no)
  on conflict(game_id,user_id) do update set participation_status=case when public.game_players.participation_status='active' then 'active' else excluded.participation_status end,is_connected=true;
  return query select g_rec.code,role;
end $$;
revoke all on function public.join_lobby_v14(text) from public,anon;
grant execute on function public.join_lobby_v14(text) to authenticated;

create or replace function public.matchmake_v14()
returns table(code text,join_mode text,created_new boolean) language plpgsql security definer set search_path=public as $$
declare g_rec public.games; humans int; c text; tries int:=0;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select g.* into g_rec
  from public.games g
  where g.visibility='public' and g.allow_matchmaking and g.status in ('lobby','question','results')
    and not exists(select 1 from public.game_players me where me.game_id=g.id and me.user_id=auth.uid())
    and (select count(*) from public.game_players gp where gp.game_id=g.id) < g.max_players
  order by case when g.status='lobby' then 0 else 1 end, case when g.lobby_kind='matchmaking' then 0 else 1 end, g.created_at desc
  limit 1 for update skip locked;

  if g_rec.id is not null then
    insert into public.game_players(game_id,user_id,participation_status,joined_cycle)
    values(g_rec.id,auth.uid(),case when g_rec.status='lobby' then 'active' else 'spectator' end,g_rec.cycle_no);
    return query select g_rec.code,case when g_rec.status='lobby' then 'player' else 'spectator' end,false;
    return;
  end if;

  loop c:=public.make_code(); tries:=tries+1; exit when not exists(select 1 from public.games where games.code=c); if tries>20 then raise exception 'Could not allocate matchmaking code'; end if; end loop;
  insert into public.games(code,host_id,title,category,difficulty,question_count,max_players,game_mode,seconds_per_question,visibility,allow_matchmaking,lobby_kind,matchmaking_target)
  values(c,auth.uid(),'Quick Match','Any','any',10,10,'standard',20,'public',true,'matchmaking',10) returning * into g_rec;
  insert into public.game_players(game_id,user_id,participation_status,joined_cycle) values(g_rec.id,auth.uid(),'active',g_rec.cycle_no);
  perform public._start_game_v14(g_rec.id);
  return query select c,'player',true;
end $$;
revoke all on function public.matchmake_v14() from public,anon;
grant execute on function public.matchmake_v14() to authenticated;

create or replace function public.start_lobby_v14(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare g_rec public.games;
begin
  select g.* into g_rec from public.games g where g.id=p_game_id for update;
  if g_rec.id is null then raise exception 'Game not found'; end if;
  if g_rec.host_id<>auth.uid() then raise exception 'Host only'; end if;
  perform public._start_game_v14(p_game_id);
end $$;
revoke all on function public.start_lobby_v14(uuid) from public,anon;
grant execute on function public.start_lobby_v14(uuid) to authenticated;

create or replace function public.get_lobby_v14(p_code text)
returns table(
  id uuid,code text,host_id uuid,title text,category text,difficulty text,question_count int,max_players int,game_mode text,seconds_per_question int,
  status text,current_question_index int,question_started_at timestamptz,results_started_at timestamptz,finished_at timestamptz,rewards_awarded_at timestamptz,
  visibility text,allow_matchmaking boolean,lobby_kind text,matchmaking_target int,cycle_no int,my_participation_status text,human_count bigint,bot_count bigint,player_count bigint
) language sql security definer set search_path=public as $$
  select g.id,g.code,g.host_id,g.title,g.category,g.difficulty,g.question_count,g.max_players,g.game_mode,g.seconds_per_question,
    g.status,g.current_question_index,g.question_started_at,g.results_started_at,g.finished_at,g.rewards_awarded_at,
    g.visibility,g.allow_matchmaking,g.lobby_kind,g.matchmaking_target,g.cycle_no,
    (select gp.participation_status from public.game_players gp where gp.game_id=g.id and gp.user_id=auth.uid()),
    (select count(*) from public.game_players gp where gp.game_id=g.id),
    (select count(*) from public.game_bots gb where gb.game_id=g.id),
    (select count(*) from public.game_players gp where gp.game_id=g.id)+(select count(*) from public.game_bots gb where gb.game_id=g.id)
  from public.games g where g.code=upper(trim(p_code)) and (
    g.visibility='public' or g.status='lobby' or g.host_id=auth.uid() or exists(select 1 from public.game_players gp where gp.game_id=g.id and gp.user_id=auth.uid())
  );
$$;
revoke all on function public.get_lobby_v14(text) from public;
grant execute on function public.get_lobby_v14(text) to anon,authenticated;

create or replace function public.get_lobby_players_v14(p_game_id uuid)
returns table(user_id text,username text,avatar_url text,total_score int,is_bot boolean,participation_status text)
language sql security definer set search_path=public as $$
  select gp.user_id::text,pr.username,pr.avatar_url,gp.total_score,false,gp.participation_status
  from public.game_players gp join public.profiles pr on pr.user_id=gp.user_id where gp.game_id=p_game_id
  union all
  select 'bot:'||gb.bot_id::text,gb.username,null::text,gb.total_score,true,'active'::text from public.game_bots gb where gb.game_id=p_game_id
  order by total_score desc,username;
$$;
revoke all on function public.get_lobby_players_v14(uuid) from public,anon;
grant execute on function public.get_lobby_players_v14(uuid) to authenticated;

create or replace function public._score_bots_v14(p_game_id uuid,p_ordinal int)
returns void language plpgsql security definer set search_path=public as $$
declare b record; q public.questions; guess numeric; av text; pts int; nopts int; pick int;
begin
  select qu.* into q from public.game_questions gq join public.questions qu on qu.id=gq.question_id where gq.game_id=p_game_id and gq.ordinal=p_ordinal;
  if q.id is null then return; end if;
  for b in select * from public.game_bots gb where gb.game_id=p_game_id loop
    if exists(select 1 from public.game_bot_answers ba where ba.game_id=p_game_id and ba.ordinal=p_ordinal and ba.bot_id=b.bot_id) then continue; end if;
    guess:=null; av:=null; pts:=0;
    if q.question_type='numeric' then
      if q.answer_numeric is not null and q.answer_numeric<>0 then guess:=q.answer_numeric*power(10,(random()-.5)*(1.5-(b.skill::numeric*.95))); else guess:=coalesce(q.answer_numeric,0)+(random()-.5)*100; end if;
      av:=guess::text; pts:=public.numeric_score(guess,q.answer_numeric);
    elsif q.question_type='multiple_choice' then
      nopts:=greatest(1,jsonb_array_length(q.options));
      if random() < (.25 + b.skill*.65) then pick:=q.correct_option; else pick:=floor(random()*nopts)::int; end if;
      av:=pick::text; pts:=case when pick=q.correct_option then 1000 else 0 end;
    else
      if random() < (.15+b.skill*.55) then av:=q.answer_text; pts:=1000; else av:='—'; pts:=0; end if;
    end if;
    insert into public.game_bot_answers(game_id,ordinal,bot_id,answer_value,answer_numeric,score) values(p_game_id,p_ordinal,b.bot_id,av,guess,pts);
    update public.game_bots gb set total_score=gb.total_score+pts where gb.game_id=p_game_id and gb.bot_id=b.bot_id;
  end loop;
end $$;
revoke all on function public._score_bots_v14(uuid,int) from public,anon,authenticated;

create or replace function public.get_round_results_v14(p_game_id uuid)
returns table(user_id text,username text,avatar_url text,answer_numeric numeric,answer_value text,score int,total_score int,xp_awarded int,is_me boolean,is_bot boolean,participation_status text)
language sql security definer set search_path=public as $$
  select gp.user_id::text,pr.username,pr.avatar_url,ga.answer_numeric,ga.answer_value,coalesce(ga.score,0),gp.total_score,gp.xp_awarded,(gp.user_id=auth.uid()),false,gp.participation_status
  from public.games g join public.game_players gp on gp.game_id=g.id join public.profiles pr on pr.user_id=gp.user_id
  left join public.game_answers ga on ga.game_id=g.id and ga.ordinal=g.current_question_index and ga.user_id=gp.user_id
  where g.id=p_game_id and g.status in('results','finished') and gp.participation_status='active'
  union all
  select 'bot:'||gb.bot_id::text,gb.username,null::text,ba.answer_numeric,ba.answer_value,coalesce(ba.score,0),gb.total_score,0,false,true,'active'
  from public.games g join public.game_bots gb on gb.game_id=g.id left join public.game_bot_answers ba on ba.game_id=g.id and ba.ordinal=g.current_question_index and ba.bot_id=gb.bot_id
  where g.id=p_game_id and g.status in('results','finished')
  order by 7 desc,6 desc,2;
$$;
revoke all on function public.get_round_results_v14(uuid) from public,anon;
grant execute on function public.get_round_results_v14(uuid) to authenticated;

create or replace function public.submit_game_answer(p_game_id uuid,p_answer text,p_response_ms int default 0)
returns table(score int,total_score int) language plpgsql security definer set search_path=public as $$
declare g_rec public.games; q_rec public.questions; p_points int; p_numeric_answer numeric; p_inserted int; p_total int;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select g.* into g_rec from public.games g where g.id=p_game_id for update;
  if g_rec.id is null then raise exception 'Game not found'; end if;
  if g_rec.status<>'question' then raise exception 'Answers are closed'; end if;
  if not exists(select 1 from public.game_players gp where gp.game_id=p_game_id and gp.user_id=auth.uid() and gp.participation_status='active') then raise exception 'Spectators join on the next match'; end if;
  if now() >= g_rec.question_started_at + make_interval(secs=>g_rec.seconds_per_question) then raise exception 'Time expired'; end if;
  select q.* into q_rec from public.game_questions gq join public.questions q on q.id=gq.question_id where gq.game_id=g_rec.id and gq.ordinal=g_rec.current_question_index;
  p_points:=public.score_answer(q_rec,p_answer);
  if q_rec.question_type='numeric' then begin p_numeric_answer:=p_answer::numeric; exception when others then p_numeric_answer:=null; end; end if;
  insert into public.game_answers(game_id,ordinal,user_id,answer_value,answer_numeric,score,response_ms)
  values(g_rec.id,g_rec.current_question_index,auth.uid(),left(p_answer,200),p_numeric_answer,p_points,greatest(0,coalesce(p_response_ms,0))) on conflict do nothing;
  get diagnostics p_inserted=row_count;
  if p_inserted=1 then update public.game_players gp set total_score=gp.total_score+p_points where gp.game_id=g_rec.id and gp.user_id=auth.uid() returning gp.total_score into p_total;
  else select gp.total_score into p_total from public.game_players gp where gp.game_id=g_rec.id and gp.user_id=auth.uid(); end if;
  return query select p_points,coalesce(p_total,0);
end $$;
revoke all on function public.submit_game_answer(uuid,text,int) from public,anon;
grant execute on function public.submit_game_answer(uuid,text,int) to authenticated;

create or replace function public._finalize_game_v14(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare g_rec public.games; winner_id uuid; human_top int; bot_top int;
begin
  select g.* into g_rec from public.games g where g.id=p_game_id for update;
  if g_rec.id is null then return; end if;
  perform public._score_bots_v14(p_game_id,g_rec.current_question_index);
  if g_rec.rewards_awarded_at is null then
    select coalesce(max(gp.total_score),-1) into human_top from public.game_players gp where gp.game_id=p_game_id and gp.participation_status='active';
    select coalesce(max(gb.total_score),-1) into bot_top from public.game_bots gb where gb.game_id=p_game_id;
    if human_top>=bot_top then select gp.user_id into winner_id from public.game_players gp where gp.game_id=p_game_id and gp.participation_status='active' order by gp.total_score desc,gp.joined_at asc limit 1; end if;
    update public.game_players gp set xp_awarded=case when gp.participation_status='active' then greatest(0,gp.total_score) else 0 end where gp.game_id=p_game_id;
    update public.profiles pr set games_played=pr.games_played+1,wins=pr.wins+case when pr.user_id=winner_id then 1 else 0 end,
      xp=pr.xp+coalesce((select greatest(0,gp.total_score) from public.game_players gp where gp.game_id=p_game_id and gp.user_id=pr.user_id and gp.participation_status='active'),0)
    where exists(select 1 from public.game_players gp where gp.game_id=p_game_id and gp.user_id=pr.user_id and gp.participation_status='active');
    update public.games g set rewards_awarded_at=now() where g.id=p_game_id and g.rewards_awarded_at is null;
  end if;
  update public.games g set status='finished',finished_at=coalesce(g.finished_at,now()) where g.id=p_game_id;
end $$;
revoke all on function public._finalize_game_v14(uuid) from public,anon,authenticated;

create or replace function public._reset_lobby_v14(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  delete from public.game_answers where game_id=p_game_id;
  delete from public.game_bot_answers where game_id=p_game_id;
  delete from public.game_bots where game_id=p_game_id;
  delete from public.game_questions where game_id=p_game_id;
  update public.game_players gp set total_score=0,xp_awarded=0,participation_status='active',joined_cycle=(select g.cycle_no+1 from public.games g where g.id=p_game_id) where gp.game_id=p_game_id;
  update public.games g set status='lobby',current_question_index=0,question_started_at=null,results_started_at=null,finished_at=null,rewards_awarded_at=null,library_session_id=null,cycle_no=g.cycle_no+1 where g.id=p_game_id;
end $$;
revoke all on function public._reset_lobby_v14(uuid) from public,anon,authenticated;

create or replace function public.sync_game_clock_v14(p_game_id uuid)
returns table(status text,current_question_index int,question_count int,question_started_at timestamptz,results_started_at timestamptz,finished_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare g_rec public.games; deadline timestamptz; reveal_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select g.* into g_rec from public.games g where g.id=p_game_id for update;
  if g_rec.id is null then raise exception 'Game not found'; end if;
  if not exists(select 1 from public.game_players gp where gp.game_id=p_game_id and gp.user_id=auth.uid()) then raise exception 'Not in game'; end if;
  if g_rec.status='question' and g_rec.question_started_at is not null then
    deadline:=g_rec.question_started_at+make_interval(secs=>g_rec.seconds_per_question);
    if now()>=deadline then perform public._score_bots_v14(p_game_id,g_rec.current_question_index); update public.games g set status='results',results_started_at=coalesce(g.results_started_at,deadline) where g.id=p_game_id; select g.* into g_rec from public.games g where g.id=p_game_id; end if;
  end if;
  if g_rec.status='results' then
    reveal_at:=coalesce(g_rec.results_started_at,now());
    if now()>=reveal_at+interval '5 seconds' then
      if g_rec.current_question_index+1>=g_rec.question_count then perform public._finalize_game_v14(p_game_id);
      else update public.games g set current_question_index=g.current_question_index+1,status='question',question_started_at=now(),results_started_at=null where g.id=p_game_id; end if;
      select g.* into g_rec from public.games g where g.id=p_game_id;
    end if;
  elsif g_rec.status='finished' and g_rec.finished_at is not null and now()>=g_rec.finished_at+interval '8 seconds' then
    perform public._reset_lobby_v14(p_game_id); select g.* into g_rec from public.games g where g.id=p_game_id;
  end if;
  return query select g_rec.status,g_rec.current_question_index,g_rec.question_count,g_rec.question_started_at,g_rec.results_started_at,g_rec.finished_at;
end $$;
revoke all on function public.sync_game_clock_v14(uuid) from public,anon;
grant execute on function public.sync_game_clock_v14(uuid) to authenticated;

create or replace function public.reveal_round_v14(p_game_id uuid,p_expected_index int)
returns void language plpgsql security definer set search_path=public as $$
declare g_rec public.games;
begin
  select g.* into g_rec from public.games g where g.id=p_game_id for update;
  if g_rec.id is null then raise exception 'Game not found'; end if; if g_rec.host_id<>auth.uid() then raise exception 'Host only'; end if;
  if g_rec.status<>'question' or g_rec.current_question_index<>p_expected_index then return; end if;
  perform public._score_bots_v14(p_game_id,p_expected_index);
  update public.games g set status='results',results_started_at=now() where g.id=p_game_id;
end $$;
revoke all on function public.reveal_round_v14(uuid,int) from public,anon;
grant execute on function public.reveal_round_v14(uuid,int) to authenticated;

create or replace function public.advance_round_v14(p_game_id uuid,p_expected_index int)
returns void language plpgsql security definer set search_path=public as $$
declare g_rec public.games;
begin
  select g.* into g_rec from public.games g where g.id=p_game_id for update;
  if g_rec.id is null then raise exception 'Game not found'; end if; if g_rec.host_id<>auth.uid() then raise exception 'Host only'; end if;
  if g_rec.status<>'results' or g_rec.current_question_index<>p_expected_index then return; end if;
  if g_rec.current_question_index+1>=g_rec.question_count then perform public._finalize_game_v14(p_game_id);
  else update public.games g set current_question_index=g.current_question_index+1,status='question',question_started_at=now(),results_started_at=null where g.id=p_game_id; end if;
end $$;
revoke all on function public.advance_round_v14(uuid,int) from public,anon;
grant execute on function public.advance_round_v14(uuid,int) to authenticated;

create or replace function public.return_to_lobby_v14(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare g_rec public.games;
begin
  select g.* into g_rec from public.games g where g.id=p_game_id for update;
  if g_rec.id is null or g_rec.status<>'finished' then return; end if;
  if not exists(select 1 from public.game_players gp where gp.game_id=p_game_id and gp.user_id=auth.uid()) then raise exception 'Not in game'; end if;
  if g_rec.host_id<>auth.uid() and now()<g_rec.finished_at+interval '5 seconds' then return; end if;
  perform public._reset_lobby_v14(p_game_id);
end $$;
revoke all on function public.return_to_lobby_v14(uuid) from public,anon;
grant execute on function public.return_to_lobby_v14(uuid) to authenticated;

create or replace function public._admin_finalize_game_after_removal(p_game_id uuid,p_rounds int)
returns void language plpgsql security definer set search_path=public as $$
declare rounds int:=greatest(coalesce(p_rounds,0),0);
begin
  update public.games g set question_count=greatest(rounds,1),current_question_index=greatest(rounds-1,0),
    status=case when g.status='finished' then g.status else 'results' end,results_started_at=coalesce(g.results_started_at,now()) where g.id=p_game_id;
  perform public._finalize_game_v14(p_game_id);
end $$;
revoke all on function public._admin_finalize_game_after_removal(uuid,int) from public,anon,authenticated;

-- ============================================================================
-- FINAL SCHEMA AUDIT
-- Returns one row. missing_tables/columns/rpcs should all be empty arrays.
-- ============================================================================
with required_tables(name) as (values
  ('profiles'),('questions'),('games'),('game_players'),('game_questions'),('game_answers'),('daily_attempts'),
  ('practice_sessions'),('practice_questions'),('practice_answers'),('question_answer_stats'),('library_sessions'),
  ('question_media_candidates'),('question_votes'),('question_audit_log'),('game_bots'),('game_bot_answers')
), missing_tables as (
  select name from required_tables where to_regclass('public.'||name) is null
), required_columns(tbl,col) as (values
  ('profiles','username_customized'),('profiles','ui_theme'),
  ('questions','canonical_key'),('questions','image_url'),('questions','media_query'),('questions','media_review_status'),
  ('questions','media_locked'),('questions','media_candidate_id'),('questions','updated_at'),('questions','deleted_at'),
  ('questions','deleted_by'),('questions','delete_reason'),('questions','content_locked'),
  ('games','library_session_id'),('games','results_started_at'),('games','rewards_awarded_at'),('games','visibility'),
  ('games','allow_matchmaking'),('games','lobby_kind'),('games','matchmaking_target'),('games','cycle_no'),
  ('game_players','xp_awarded'),('game_players','participation_status'),('game_players','joined_cycle'),
  ('practice_sessions','library_session_id'),('practice_sessions','origin_library_session_id')
), missing_columns as (
  select tbl||'.'||col as name from required_columns rc
  where not exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=rc.tbl and c.column_name=rc.col)
), required_rpcs(sig) as (values
  ('sync_my_google_profile()'),('update_my_profile(text)'),('update_my_ui_theme(text)'),
  ('get_daily_state_v6()'),('submit_daily_answer(text)'),('start_practice(text[],text,integer)'),
  ('get_practice_question_v6(uuid)'),('submit_practice_answer(uuid,text,integer)'),('next_practice_question(uuid)'),
  ('get_practice_summary(uuid)'),('get_library_sessions(text,text,text,text,integer,integer)'),('start_library_practice(uuid)'),
  ('get_question_community_stats(uuid)'),('get_question_vote_summary(uuid)'),('vote_question(uuid,integer)'),
  ('is_trivia_admin()'),('admin_question_overview()'),('admin_list_questions_v10(text,text,text,text,text,integer,integer)'),
  ('admin_get_question_v10(uuid)'),('admin_create_question_v10(jsonb)'),('admin_update_question_v10(uuid,jsonb)'),
  ('admin_delete_question_v10(uuid,text,uuid)'),('admin_restore_question_v10(uuid)'),('admin_list_question_audit_v10(text,text,integer,integer)'),
  ('admin_media_overview()'),('admin_list_media_questions(text,text,text,text,integer,integer)'),('admin_get_question_media(uuid)'),
  ('admin_select_media_candidate(uuid,uuid,boolean)'),('admin_use_external_media(uuid,text,text,text,text,text,text,text,text,text,text,integer,integer,numeric,boolean,boolean)'),
  ('admin_reject_media_candidate(uuid)'),('admin_export_media_job(text,integer)'),('admin_import_media_results(jsonb,boolean,boolean)'),
  ('admin_import_content_package_v12(jsonb,text,boolean,boolean,boolean)'),
  ('create_lobby_v14(text,text,integer,integer,text,integer,text,text,boolean)'),('join_lobby_v14(text)'),('matchmake_v14()'),
  ('start_lobby_v14(uuid)'),('get_lobby_v14(text)'),('get_lobby_players_v14(uuid)'),('get_round_results_v14(uuid)'),
  ('submit_game_answer(uuid,text,integer)'),('sync_game_clock_v14(uuid)'),('reveal_round_v14(uuid,integer)'),
  ('advance_round_v14(uuid,integer)'),('return_to_lobby_v14(uuid)')
), missing_rpcs as (
  select sig from required_rpcs where to_regprocedure('public.'||sig) is null
)
select
  coalesce((select jsonb_agg(name order by name) from missing_tables),'[]'::jsonb) as missing_tables,
  coalesce((select jsonb_agg(name order by name) from missing_columns),'[]'::jsonb) as missing_columns,
  coalesce((select jsonb_agg(sig order by sig) from missing_rpcs),'[]'::jsonb) as missing_rpcs,
  case when not exists(select 1 from missing_tables) and not exists(select 1 from missing_columns) and not exists(select 1 from missing_rpcs)
       then 'READY' else 'CHECK OUTPUT' end as schema_status;
