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
