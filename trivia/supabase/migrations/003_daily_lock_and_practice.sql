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
