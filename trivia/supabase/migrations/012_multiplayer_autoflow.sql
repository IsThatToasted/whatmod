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
