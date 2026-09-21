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
