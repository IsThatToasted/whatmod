-- WhatMod Trivia V23 - Board Battle multiplayer mode
-- Six categories x five clue values ($400-$2000), 2-10 players, buzzing,
-- score swings, hidden double-down cells, and a final wager clue.

alter table public.games add column if not exists experience_mode text not null default 'estimate';

-- Board replays contain 30 board clues plus the final clue. Existing Practice
-- creation still caps normal user-created runs, but Library replay sessions need room for 31.
alter table public.practice_sessions drop constraint if exists practice_sessions_question_count_check;
alter table public.practice_sessions add constraint practice_sessions_question_count_check check(question_count between 1 and 50);
create index if not exists games_experience_mode_idx on public.games(experience_mode,status);

create table if not exists public.board_games (
  game_id uuid primary key references public.games(id) on delete cascade,
  category_names text[] not null,
  phase text not null default 'lobby' check (phase in ('lobby','board','wager','buzz','answer','reveal','final_wager','final_clue','finished')),
  control_user_id uuid references auth.users(id) on delete set null,
  active_cell_id uuid,
  buzz_user_id uuid references auth.users(id) on delete set null,
  active_wager integer not null default 0,
  clue_opened_at timestamptz,
  buzz_opened_at timestamptz,
  answer_started_at timestamptz,
  reveal_started_at timestamptz,
  final_question_id uuid references public.questions(id) on delete set null,
  final_category text,
  final_clue_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint board_six_categories check (coalesce(array_length(category_names,1),0)=6)
);

create table if not exists public.board_cells (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  col_index integer not null check (col_index between 0 and 5),
  row_index integer not null check (row_index between 0 and 4),
  category text not null,
  clue_value integer not null check (clue_value in (400,800,1200,1600,2000)),
  question_id uuid not null references public.questions(id),
  special_kind text not null default 'normal' check (special_kind in ('normal','double')),
  is_used boolean not null default false,
  selected_by uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  outcome text,
  unique(game_id,col_index,row_index)
);

alter table public.board_games
  drop constraint if exists board_games_active_cell_id_fkey;
alter table public.board_games
  add constraint board_games_active_cell_id_fkey foreign key(active_cell_id) references public.board_cells(id) on delete set null;

create table if not exists public.board_lockouts (
  game_id uuid not null references public.games(id) on delete cascade,
  cell_id uuid not null references public.board_cells(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  locked_at timestamptz not null default now(),
  primary key(game_id,cell_id,user_id)
);

create table if not exists public.board_answers (
  game_id uuid not null references public.games(id) on delete cascade,
  cell_id uuid not null references public.board_cells(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer_value text,
  is_correct boolean not null default false,
  score_delta integer not null default 0,
  wager integer not null default 0,
  submitted_at timestamptz not null default now(),
  primary key(game_id,cell_id,user_id)
);

create table if not exists public.board_final_entries (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  wager integer not null default 0,
  answer_value text,
  is_correct boolean,
  score_delta integer,
  wagered_at timestamptz not null default now(),
  answered_at timestamptz,
  primary key(game_id,user_id)
);

create index if not exists board_cells_game_used_idx on public.board_cells(game_id,is_used,col_index,row_index);
create index if not exists board_answers_game_cell_idx on public.board_answers(game_id,cell_id,submitted_at);
create index if not exists board_final_game_idx on public.board_final_entries(game_id);

alter table public.board_games enable row level security;
alter table public.board_cells enable row level security;
alter table public.board_lockouts enable row level security;
alter table public.board_answers enable row level security;
alter table public.board_final_entries enable row level security;
revoke all on public.board_games,public.board_cells,public.board_lockouts,public.board_answers,public.board_final_entries from anon,authenticated;

create or replace function public._board_is_participant_v23(p_game_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select p_user_id is not null and exists(
    select 1 from public.games g
    left join public.game_players gp on gp.game_id=g.id and gp.user_id=p_user_id
    where g.id=p_game_id and (g.host_id=p_user_id or gp.user_id is not null)
  );
$$;
revoke all on function public._board_is_participant_v23(uuid,uuid) from public,anon,authenticated;

create or replace function public._board_answer_display_v23(q public.questions)
returns text language sql immutable as $$
  select case
    when q.question_type='numeric' then trim(to_char(q.answer_numeric,'FM999999999999990.########')) || case when coalesce(trim(q.unit),'')<>'' then ' '||trim(q.unit) else '' end
    when q.question_type='multiple_choice' then coalesce(q.options ->> q.correct_option, q.correct_option::text)
    else q.answer_text
  end;
$$;
revoke all on function public._board_answer_display_v23(public.questions) from public,anon,authenticated;

create or replace function public._board_correct_v23(q public.questions,p_answer text)
returns boolean language plpgsql immutable as $$
declare cleaned text:=trim(coalesce(p_answer,''));
begin
  if cleaned='' then return false; end if;
  -- Existing numeric questions are often estimation-friendly, so require a very
  -- close score rather than byte-for-byte numeric equality.
  if q.question_type='numeric' then return public.score_answer(q,cleaned) >= 950; end if;
  if public.score_answer(q,cleaned)=1000 then return true; end if;
  -- Players may answer in classic quiz-board phrasing ("What is …?" /
  -- "Who is …?"). It is optional, but never penalized for text questions.
  if q.question_type='text' then
    cleaned:=regexp_replace(cleaned,'^(what|who)\s+(is|are|was|were)\s+','','i');
    return public.score_answer(q,cleaned)=1000;
  end if;
  return false;
end $$;
revoke all on function public._board_correct_v23(public.questions,text) from public,anon,authenticated;

create or replace function public._board_touch_v23(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.board_games set updated_at=now() where game_id=p_game_id;
  update public.games set last_activity_at=now() where id=p_game_id;
end $$;
revoke all on function public._board_touch_v23(uuid) from public,anon,authenticated;

create or replace function public.create_board_lobby_v23(
  p_categories text[], p_max_players int default 6, p_seconds_per_question int default 15,
  p_title text default null, p_visibility text default 'invite_only'
) returns table(id uuid,code text) language plpgsql security definer set search_path=public as $$
declare c text; tries int:=0; gid uuid; cat text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if coalesce(array_length(p_categories,1),0)<>6 then raise exception 'Choose exactly 6 categories'; end if;
  if (select count(distinct x) from unnest(p_categories) x)<>6 then raise exception 'Categories must be unique'; end if;
  if p_max_players<2 or p_max_players>10 then raise exception 'Board Battle supports 2-10 players'; end if;
  if p_visibility not in ('public','invite_only') then raise exception 'Invalid lobby visibility'; end if;
  foreach cat in array p_categories loop
    if (select count(*) from public.questions q where q.is_active and q.category=cat)<5 then
      raise exception 'Category % needs at least 5 active questions',cat;
    end if;
  end loop;
  if (select count(*) from public.questions q where q.is_active and q.category=any(p_categories))<31 then
    raise exception 'These six categories need at least 31 active questions in total so Final has a fresh clue';
  end if;
  loop
    c:=public.make_code(); tries:=tries+1;
    exit when not exists(select 1 from public.games where games.code=c);
    if tries>20 then raise exception 'Could not allocate lobby code'; end if;
  end loop;
  insert into public.games(code,host_id,title,category,difficulty,question_count,max_players,game_mode,seconds_per_question,
    visibility,allow_matchmaking,lobby_kind,matchmaking_target,experience_mode,last_activity_at,last_human_seen_at)
  values(c,auth.uid(),nullif(trim(p_title),''),'Board Battle','mixed',30,p_max_players,'standard',greatest(10,least(30,p_seconds_per_question)),
    p_visibility,false,'custom',p_max_players,'board',now(),now()) returning games.id into gid;
  insert into public.game_players(game_id,user_id,participation_status,joined_cycle,is_connected)
  values(gid,auth.uid(),'active',1,true);
  insert into public.board_games(game_id,category_names,phase) values(gid,p_categories,'lobby');
  return query select gid,c;
end $$;
revoke all on function public.create_board_lobby_v23(text[],int,int,text,text) from public,anon;
grant execute on function public.create_board_lobby_v23(text[],int,int,text,text) to authenticated;

create or replace function public.start_board_game_v23(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare g public.games; bg public.board_games; cat text; ci int; ri int; qid uuid; used_ids uuid[]:='{}'::uuid[]; control_id uuid;
begin
  select * into g from public.games where id=p_game_id for update;
  select * into bg from public.board_games where game_id=p_game_id for update;
  if g.id is null or bg.game_id is null then raise exception 'Board lobby not found'; end if;
  if g.host_id<>auth.uid() then raise exception 'Host only'; end if;
  if g.status<>'lobby' then raise exception 'Game already started'; end if;
  if (select count(*) from public.game_players gp where gp.game_id=p_game_id and gp.participation_status='active')<2 then raise exception 'At least 2 players are required'; end if;
  if (select count(*) from public.game_players gp where gp.game_id=p_game_id and gp.participation_status='active')>10 then raise exception 'Board Battle supports at most 10 players'; end if;

  delete from public.board_lockouts where game_id=p_game_id;
  delete from public.board_answers where game_id=p_game_id;
  delete from public.board_final_entries where game_id=p_game_id;
  delete from public.board_cells where game_id=p_game_id;
  delete from public.game_questions where game_id=p_game_id;
  delete from public.game_bots where game_id=p_game_id;
  update public.game_players set total_score=0,xp_awarded=0,participation_status='active' where game_id=p_game_id;

  ci:=0;
  foreach cat in array bg.category_names loop
    for ri in 0..4 loop
      qid:=null;
      select q.id into qid from public.questions q
      where q.is_active and q.category=cat and q.id <> all(used_ids)
        and (
          (ri=0 and q.difficulty='easy') or
          (ri=1 and q.difficulty in ('easy','medium')) or
          (ri=2 and q.difficulty='medium') or
          (ri=3 and q.difficulty in ('medium','hard')) or
          (ri=4 and q.difficulty='hard')
        )
      order by random() limit 1;
      if qid is null then
        select q.id into qid from public.questions q
        where q.is_active and q.category=cat and q.id <> all(used_ids)
        order by random() limit 1;
      end if;
      if qid is null then raise exception 'Not enough unique questions in %',cat; end if;
      used_ids:=array_append(used_ids,qid);
      insert into public.board_cells(game_id,col_index,row_index,category,clue_value,question_id)
      values(p_game_id,ci,ri,cat,(ri+1)*400,qid);
    end loop;
    ci:=ci+1;
  end loop;

  -- Two hidden double-down clues, weighted toward the more valuable rows.
  update public.board_cells set special_kind='double'
  where id in (
    select id from public.board_cells where game_id=p_game_id and row_index>=1 order by random() limit 2
  );

  insert into public.game_questions(game_id,ordinal,question_id)
  select p_game_id,row_number() over(order by col_index,row_index)-1,question_id
  from public.board_cells where game_id=p_game_id order by col_index,row_index;

  select gp.user_id into control_id from public.game_players gp
  where gp.game_id=p_game_id and gp.participation_status='active' order by random() limit 1;

  update public.board_games set phase='board',control_user_id=control_id,active_cell_id=null,buzz_user_id=null,
    active_wager=0,clue_opened_at=null,buzz_opened_at=null,answer_started_at=null,reveal_started_at=null,
    final_question_id=null,final_category=null,final_clue_started_at=null,updated_at=now()
  where game_id=p_game_id;
  update public.games set status='question',current_question_index=0,question_started_at=now(),results_started_at=null,
    finished_at=null,rewards_awarded_at=null,library_session_id=null,last_activity_at=now() where id=p_game_id;
end $$;
revoke all on function public.start_board_game_v23(uuid) from public,anon;
grant execute on function public.start_board_game_v23(uuid) to authenticated;

create or replace function public.board_select_cell_v23(p_game_id uuid,p_cell_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare bg public.board_games; c public.board_cells;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into bg from public.board_games where game_id=p_game_id for update;
  if bg.game_id is null then raise exception 'Board game not found'; end if;
  if bg.phase<>'board' then raise exception 'The board is not ready for a selection'; end if;
  if bg.control_user_id<>auth.uid() then raise exception 'The player with board control chooses the clue'; end if;
  select * into c from public.board_cells where id=p_cell_id and game_id=p_game_id for update;
  if c.id is null or c.is_used then raise exception 'That clue is no longer available'; end if;
  update public.board_cells set selected_by=auth.uid() where id=c.id;
  delete from public.board_lockouts where game_id=p_game_id and cell_id=c.id;
  if c.special_kind='double' then
    update public.board_games set phase='wager',active_cell_id=c.id,buzz_user_id=auth.uid(),active_wager=0,
      clue_opened_at=now(),buzz_opened_at=null,answer_started_at=null,reveal_started_at=null,updated_at=now()
    where game_id=p_game_id;
  else
    update public.board_games set phase='buzz',active_cell_id=c.id,buzz_user_id=null,active_wager=0,
      clue_opened_at=now(),buzz_opened_at=now(),answer_started_at=null,reveal_started_at=null,updated_at=now()
    where game_id=p_game_id;
  end if;
  update public.games set last_activity_at=now(),question_started_at=now() where id=p_game_id;
  return jsonb_build_object('ok',true,'special',c.special_kind);
end $$;
revoke all on function public.board_select_cell_v23(uuid,uuid) from public,anon;
grant execute on function public.board_select_cell_v23(uuid,uuid) to authenticated;

create or replace function public.board_buzz_v23(p_game_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare bg public.board_games;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into bg from public.board_games where game_id=p_game_id for update;
  if bg.game_id is null or bg.phase<>'buzz' or bg.active_cell_id is null then return jsonb_build_object('accepted',false); end if;
  if bg.buzz_opened_at is not null and now()-bg.buzz_opened_at>interval '12 seconds' then
    return jsonb_build_object('accepted',false,'reason','expired');
  end if;
  if not exists(select 1 from public.game_players gp where gp.game_id=p_game_id and gp.user_id=auth.uid() and gp.participation_status='active') then raise exception 'Active players only'; end if;
  if exists(select 1 from public.board_lockouts l where l.game_id=p_game_id and l.cell_id=bg.active_cell_id and l.user_id=auth.uid()) then
    return jsonb_build_object('accepted',false,'reason','locked_out');
  end if;
  update public.board_games set phase='answer',buzz_user_id=auth.uid(),answer_started_at=now(),updated_at=now() where game_id=p_game_id;
  update public.games set last_activity_at=now() where id=p_game_id;
  return jsonb_build_object('accepted',true,'user_id',auth.uid());
end $$;
revoke all on function public.board_buzz_v23(uuid) from public,anon;
grant execute on function public.board_buzz_v23(uuid) to authenticated;

create or replace function public.board_submit_wager_v23(p_game_id uuid,p_wager int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare bg public.board_games; c public.board_cells; gp public.game_players; max_wager int;
begin
  select * into bg from public.board_games where game_id=p_game_id for update;
  if bg.phase<>'wager' or bg.active_cell_id is null or bg.buzz_user_id<>auth.uid() then raise exception 'No wager is waiting for you'; end if;
  if bg.clue_opened_at is not null and now()-bg.clue_opened_at>interval '30 seconds' then raise exception 'Wager time expired'; end if;
  select * into c from public.board_cells where id=bg.active_cell_id;
  select * into gp from public.game_players where game_id=p_game_id and user_id=auth.uid();
  max_wager:=greatest(2000,coalesce(gp.total_score,0));
  if p_wager<0 or p_wager>max_wager then raise exception 'Wager must be between 0 and %',max_wager; end if;
  update public.board_games set active_wager=p_wager,phase='answer',answer_started_at=now(),updated_at=now() where game_id=p_game_id;
  update public.games set last_activity_at=now() where id=p_game_id;
  return jsonb_build_object('ok',true,'wager',p_wager,'max_wager',max_wager);
end $$;
revoke all on function public.board_submit_wager_v23(uuid,int) from public,anon;
grant execute on function public.board_submit_wager_v23(uuid,int) to authenticated;

create or replace function public.board_submit_answer_v23(p_game_id uuid,p_answer text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare bg public.board_games; g public.games; c public.board_cells; q public.questions; correct boolean; delta int; stake int; active_count int; locked_count int;
begin
  select * into g from public.games where id=p_game_id;
  select * into bg from public.board_games where game_id=p_game_id for update;
  if bg.game_id is null or bg.phase<>'answer' or bg.active_cell_id is null then raise exception 'No clue is accepting an answer'; end if;
  if bg.buzz_user_id<>auth.uid() then raise exception 'Another player has the buzzer'; end if;
  if bg.answer_started_at is not null and now()-bg.answer_started_at>make_interval(secs=>greatest(10,least(30,coalesce(g.seconds_per_question,15)))) then
    raise exception 'Answer time expired';
  end if;
  select * into c from public.board_cells where id=bg.active_cell_id for update;
  select * into q from public.questions where id=c.question_id;
  correct:=public._board_correct_v23(q,p_answer);
  stake:=case when c.special_kind='double' then bg.active_wager else c.clue_value end;
  delta:=case when correct then stake else -stake end;
  update public.game_players set total_score=total_score+delta where game_id=p_game_id and user_id=auth.uid();
  insert into public.board_answers(game_id,cell_id,user_id,answer_value,is_correct,score_delta,wager)
  values(p_game_id,c.id,auth.uid(),p_answer,correct,delta,case when c.special_kind='double' then stake else 0 end)
  on conflict(game_id,cell_id,user_id) do update set answer_value=excluded.answer_value,is_correct=excluded.is_correct,
    score_delta=excluded.score_delta,wager=excluded.wager,submitted_at=now();

  if correct or c.special_kind='double' then
    update public.board_cells set is_used=true,resolved_by=auth.uid(),outcome=case when correct then 'correct' else 'wrong' end where id=c.id;
    update public.board_games set phase='reveal',control_user_id=auth.uid(),reveal_started_at=now(),buzz_user_id=null,updated_at=now() where game_id=p_game_id;
  else
    insert into public.board_lockouts(game_id,cell_id,user_id) values(p_game_id,c.id,auth.uid()) on conflict do nothing;
    select count(*) into active_count from public.game_players gp where gp.game_id=p_game_id and gp.participation_status='active';
    select count(*) into locked_count from public.board_lockouts l where l.game_id=p_game_id and l.cell_id=c.id;
    if locked_count>=active_count then
      update public.board_cells set is_used=true,outcome='missed' where id=c.id;
      update public.board_games set phase='reveal',control_user_id=coalesce(c.selected_by,bg.control_user_id),reveal_started_at=now(),buzz_user_id=null,updated_at=now() where game_id=p_game_id;
    else
      update public.board_games set phase='buzz',buzz_user_id=null,buzz_opened_at=now(),answer_started_at=null,updated_at=now() where game_id=p_game_id;
    end if;
  end if;
  update public.games set current_question_index=(select count(*) from public.board_cells bc where bc.game_id=p_game_id and bc.is_used),last_activity_at=now() where id=p_game_id;
  return jsonb_build_object('correct',correct,'delta',delta,'answer',public._board_answer_display_v23(q));
end $$;
revoke all on function public.board_submit_answer_v23(uuid,text) from public,anon;
grant execute on function public.board_submit_answer_v23(uuid,text) to authenticated;

create or replace function public.board_close_clue_v23(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare g public.games; bg public.board_games; c public.board_cells;
begin
  select * into g from public.games where id=p_game_id for update;
  select * into bg from public.board_games where game_id=p_game_id for update;
  if g.host_id<>auth.uid() then raise exception 'Host only'; end if;
  if bg.phase not in ('buzz','answer') or bg.active_cell_id is null then return; end if;
  select * into c from public.board_cells where id=bg.active_cell_id;
  update public.board_cells set is_used=true,outcome='closed' where id=c.id;
  update public.board_games set phase='reveal',control_user_id=coalesce(c.selected_by,bg.control_user_id),reveal_started_at=now(),buzz_user_id=null,updated_at=now() where game_id=p_game_id;
  update public.games set current_question_index=(select count(*) from public.board_cells bc where bc.game_id=p_game_id and bc.is_used),last_activity_at=now() where id=p_game_id;
end $$;
revoke all on function public.board_close_clue_v23(uuid) from public,anon;
grant execute on function public.board_close_clue_v23(uuid) to authenticated;

create or replace function public._board_begin_final_v23(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare bg public.board_games; qid uuid; qcat text;
begin
  select * into bg from public.board_games where game_id=p_game_id for update;
  if bg.final_question_id is not null then
    update public.board_games set phase='final_wager',updated_at=now() where game_id=p_game_id;
    return;
  end if;
  select q.id,q.category into qid,qcat from public.questions q
  where q.is_active and q.category=any(bg.category_names)
    and q.difficulty='hard'
    and not exists(select 1 from public.board_cells c where c.game_id=p_game_id and c.question_id=q.id)
  order by random() limit 1;
  if qid is null then
    select q.id,q.category into qid,qcat from public.questions q
    where q.is_active and q.category=any(bg.category_names)
      and not exists(select 1 from public.board_cells c where c.game_id=p_game_id and c.question_id=q.id)
    order by random() limit 1;
  end if;
  if qid is null then return; end if;
  update public.board_games set final_question_id=qid,final_category=qcat,phase='final_wager',updated_at=now() where game_id=p_game_id;
  insert into public.game_questions(game_id,ordinal,question_id) values(p_game_id,30,qid)
  on conflict(game_id,ordinal) do update set question_id=excluded.question_id;
end $$;
revoke all on function public._board_begin_final_v23(uuid) from public,anon,authenticated;

create or replace function public.board_submit_final_wager_v23(p_game_id uuid,p_wager int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare bg public.board_games; score_now int; max_wager int; players int; wagers int;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into bg from public.board_games where game_id=p_game_id for update;
  if bg.phase<>'final_wager' then raise exception 'Final wagering is closed'; end if;
  if now()-bg.updated_at>interval '30 seconds' then raise exception 'Final wagering is closed'; end if;
  select total_score into score_now from public.game_players where game_id=p_game_id and user_id=auth.uid() and participation_status='active';
  if score_now is null then raise exception 'Active players only'; end if;
  max_wager:=greatest(0,score_now);
  if p_wager<0 or p_wager>max_wager then raise exception 'Wager must be between 0 and %',max_wager; end if;
  insert into public.board_final_entries(game_id,user_id,wager,wagered_at) values(p_game_id,auth.uid(),p_wager,now())
  on conflict(game_id,user_id) do update set wager=excluded.wager,wagered_at=now();
  select count(*) into players from public.game_players where game_id=p_game_id and participation_status='active';
  select count(*) into wagers from public.board_final_entries where game_id=p_game_id;
  if wagers>=players then update public.board_games set phase='final_clue',final_clue_started_at=now(),updated_at=now() where game_id=p_game_id; end if;
  update public.games set last_activity_at=now() where id=p_game_id;
  return jsonb_build_object('ok',true,'wager',p_wager,'max_wager',max_wager);
end $$;
revoke all on function public.board_submit_final_wager_v23(uuid,int) from public,anon;
grant execute on function public.board_submit_final_wager_v23(uuid,int) to authenticated;

create or replace function public._board_finalize_v23(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare g public.games; bg public.board_games; q public.questions; r record; winner uuid;
begin
  select * into g from public.games where id=p_game_id for update;
  select * into bg from public.board_games where game_id=p_game_id for update;
  if g.status='finished' then return; end if;
  if bg.final_question_id is not null then select * into q from public.questions where id=bg.final_question_id; end if;
  insert into public.board_final_entries(game_id,user_id,wager)
  select p_game_id,gp.user_id,0 from public.game_players gp where gp.game_id=p_game_id and gp.participation_status='active'
  on conflict(game_id,user_id) do nothing;
  if q.id is not null then
    for r in select * from public.board_final_entries where game_id=p_game_id loop
      update public.board_final_entries set
        is_correct=public._board_correct_v23(q,r.answer_value),
        score_delta=case when public._board_correct_v23(q,r.answer_value) then r.wager else -r.wager end
      where game_id=p_game_id and user_id=r.user_id;
    end loop;
    update public.game_players gp set total_score=gp.total_score+coalesce(fe.score_delta,0)
    from public.board_final_entries fe where fe.game_id=p_game_id and fe.user_id=gp.user_id and gp.game_id=p_game_id;
  end if;

  if g.rewards_awarded_at is null then
    select gp.user_id into winner from public.game_players gp where gp.game_id=p_game_id and gp.participation_status='active'
      order by gp.total_score desc,gp.joined_at asc limit 1;
    update public.game_players gp set xp_awarded=least(1500,greatest(0,round(gp.total_score/20.0)::int))
      where gp.game_id=p_game_id and gp.participation_status='active';
    update public.profiles pr set xp=pr.xp+gp.xp_awarded,games_played=pr.games_played+1,
      wins=pr.wins+case when pr.user_id=winner then 1 else 0 end
    from public.game_players gp where gp.game_id=p_game_id and gp.user_id=pr.user_id and gp.participation_status='active';
  end if;
  update public.board_games set phase='finished',updated_at=now() where game_id=p_game_id;
  update public.games set status='finished',finished_at=now(),rewards_awarded_at=coalesce(rewards_awarded_at,now()),last_activity_at=now() where id=p_game_id;
end $$;
revoke all on function public._board_finalize_v23(uuid) from public,anon,authenticated;

create or replace function public.board_submit_final_answer_v23(p_game_id uuid,p_answer text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare bg public.board_games; players int; answers int;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into bg from public.board_games where game_id=p_game_id for update;
  if bg.phase<>'final_clue' then raise exception 'Final clue is not accepting answers'; end if;
  if bg.final_clue_started_at is not null and now()-bg.final_clue_started_at>interval '30 seconds' then raise exception 'Final answer time expired'; end if;
  if not exists(select 1 from public.game_players gp where gp.game_id=p_game_id and gp.user_id=auth.uid() and gp.participation_status='active') then raise exception 'Active players only'; end if;
  insert into public.board_final_entries(game_id,user_id,wager,answer_value,answered_at)
  values(p_game_id,auth.uid(),0,p_answer,now())
  on conflict(game_id,user_id) do update set answer_value=excluded.answer_value,answered_at=now();
  select count(*) into players from public.game_players where game_id=p_game_id and participation_status='active';
  select count(*) into answers from public.board_final_entries where game_id=p_game_id and answered_at is not null;
  if answers>=players then perform public._board_finalize_v23(p_game_id); end if;
  update public.games set last_activity_at=now() where id=p_game_id;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.board_submit_final_answer_v23(uuid,text) from public,anon;
grant execute on function public.board_submit_final_answer_v23(uuid,text) to authenticated;

create or replace function public.board_sync_v23(p_game_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare bg public.board_games; g public.games; c public.board_cells; active_count int; locked_count int; stake int; answer_seconds int;
begin
  if not public._board_is_participant_v23(p_game_id,auth.uid()) then raise exception 'Not a participant'; end if;
  select * into g from public.games where id=p_game_id;
  select * into bg from public.board_games where game_id=p_game_id for update;
  answer_seconds:=greatest(10,least(30,coalesce(g.seconds_per_question,15)));
  if bg.game_id is null then raise exception 'Board game not found'; end if;

  if bg.phase='wager' and bg.clue_opened_at is not null and now()-bg.clue_opened_at>interval '30 seconds' then
    -- A disconnected Double Down player cannot freeze the room forever. Zero
    -- wager is applied and the normal answer timer begins.
    update public.board_games set active_wager=0,phase='answer',answer_started_at=now(),updated_at=now() where game_id=p_game_id;
  elsif bg.phase='buzz' and bg.buzz_opened_at is not null and now()-bg.buzz_opened_at>interval '12 seconds' then
    select * into c from public.board_cells where id=bg.active_cell_id;
    update public.board_cells set is_used=true,outcome='no_buzz' where id=c.id;
    update public.board_games set phase='reveal',control_user_id=coalesce(c.selected_by,bg.control_user_id),reveal_started_at=now(),buzz_user_id=null,updated_at=now() where game_id=p_game_id;
  elsif bg.phase='answer' and bg.answer_started_at is not null and now()-bg.answer_started_at>make_interval(secs=>answer_seconds) then
    select * into c from public.board_cells where id=bg.active_cell_id;
    stake:=case when c.special_kind='double' then bg.active_wager else c.clue_value end;
    if bg.buzz_user_id is not null then
      update public.game_players set total_score=total_score-stake where game_id=p_game_id and user_id=bg.buzz_user_id;
      insert into public.board_answers(game_id,cell_id,user_id,answer_value,is_correct,score_delta,wager)
      values(p_game_id,c.id,bg.buzz_user_id,'[timeout]',false,-stake,case when c.special_kind='double' then stake else 0 end)
      on conflict(game_id,cell_id,user_id) do update set answer_value='[timeout]',is_correct=false,score_delta=-stake,wager=excluded.wager,submitted_at=now();
    end if;
    if c.special_kind='double' then
      update public.board_cells set is_used=true,outcome='timeout',resolved_by=bg.buzz_user_id where id=c.id;
      update public.board_games set phase='reveal',control_user_id=coalesce(bg.buzz_user_id,c.selected_by,bg.control_user_id),reveal_started_at=now(),buzz_user_id=null,updated_at=now() where game_id=p_game_id;
    else
      insert into public.board_lockouts(game_id,cell_id,user_id) values(p_game_id,c.id,bg.buzz_user_id) on conflict do nothing;
      select count(*) into active_count from public.game_players where game_id=p_game_id and participation_status='active';
      select count(*) into locked_count from public.board_lockouts where game_id=p_game_id and cell_id=c.id;
      if locked_count>=active_count then
        update public.board_cells set is_used=true,outcome='missed' where id=c.id;
        update public.board_games set phase='reveal',control_user_id=coalesce(c.selected_by,bg.control_user_id),reveal_started_at=now(),buzz_user_id=null,updated_at=now() where game_id=p_game_id;
      else
        update public.board_games set phase='buzz',buzz_user_id=null,buzz_opened_at=now(),answer_started_at=null,updated_at=now() where game_id=p_game_id;
      end if;
    end if;
  elsif bg.phase='reveal' and bg.reveal_started_at is not null and now()-bg.reveal_started_at>interval '4 seconds' then
    if (select count(*) from public.board_cells where game_id=p_game_id and not is_used)=0 then
      perform public._board_begin_final_v23(p_game_id);
      select * into bg from public.board_games where game_id=p_game_id;
      if bg.final_question_id is null then perform public._board_finalize_v23(p_game_id); end if;
    else
      update public.board_games set phase='board',active_cell_id=null,buzz_user_id=null,active_wager=0,clue_opened_at=null,buzz_opened_at=null,answer_started_at=null,reveal_started_at=null,updated_at=now() where game_id=p_game_id;
    end if;
  elsif bg.phase='final_wager' and now()-bg.updated_at>interval '30 seconds' then
    insert into public.board_final_entries(game_id,user_id,wager)
    select p_game_id,gp.user_id,0 from public.game_players gp where gp.game_id=p_game_id and gp.participation_status='active'
    on conflict(game_id,user_id) do nothing;
    update public.board_games set phase='final_clue',final_clue_started_at=now(),updated_at=now() where game_id=p_game_id;
  elsif bg.phase='final_clue' and bg.final_clue_started_at is not null and now()-bg.final_clue_started_at>interval '30 seconds' then
    perform public._board_finalize_v23(p_game_id);
  end if;
  update public.games set current_question_index=(select count(*) from public.board_cells where game_id=p_game_id and is_used),last_activity_at=now() where id=p_game_id;
  select * into bg from public.board_games where game_id=p_game_id;
  return jsonb_build_object('phase',bg.phase,'updated_at',bg.updated_at);
end $$;
revoke all on function public.board_sync_v23(uuid) from public,anon;
grant execute on function public.board_sync_v23(uuid) to authenticated;

create or replace function public.get_board_state_v23(p_game_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.games; bg public.board_games; c public.board_cells; q public.questions; result jsonb; phase_text text; active_question jsonb:=null; answer_display text:=null; me uuid:=auth.uid();
begin
  if not public._board_is_participant_v23(p_game_id,me) then raise exception 'Not a participant'; end if;
  select * into g from public.games where id=p_game_id;
  select * into bg from public.board_games where game_id=p_game_id;
  if g.id is null or bg.game_id is null then raise exception 'Board game not found'; end if;
  phase_text:=bg.phase;
  if bg.active_cell_id is not null then
    select * into c from public.board_cells where id=bg.active_cell_id;
    select * into q from public.questions where id=c.question_id;
    if not (phase_text='wager' and c.special_kind='double') then
      active_question:=jsonb_build_object('id',q.id,'category',q.category,'difficulty',q.difficulty,'question_type',q.question_type,
        'prompt',q.prompt,'context',q.context,'unit',q.unit,'options',q.options,'image_url',q.image_url,'image_alt',q.image_alt,
        'image_source_url',q.image_source_url,'image_attribution',q.image_attribution,'image_license',q.image_license,'image_license_url',q.image_license_url,
        'explanation',case when phase_text='reveal' then q.explanation else null end);
    end if;
    if phase_text='reveal' then answer_display:=public._board_answer_display_v23(q); end if;
  elsif phase_text in ('final_clue','finished') and bg.final_question_id is not null then
    select * into q from public.questions where id=bg.final_question_id;
    active_question:=jsonb_build_object('id',q.id,'category',q.category,'difficulty',q.difficulty,'question_type',q.question_type,
      'prompt',q.prompt,'context',q.context,'unit',q.unit,'options',q.options,'image_url',q.image_url,'image_alt',q.image_alt,
      'image_source_url',q.image_source_url,'image_attribution',q.image_attribution,'image_license',q.image_license,'image_license_url',q.image_license_url,
      'explanation',case when phase_text='finished' then q.explanation else null end);
    if phase_text='finished' then answer_display:=public._board_answer_display_v23(q); end if;
  end if;

  result:=jsonb_build_object(
    'game_id',g.id,'code',g.code,'title',g.title,'status',g.status,'phase',bg.phase,'categories',bg.category_names,
    'seconds_per_question',g.seconds_per_question,
    'my_participation_status',(select gp.participation_status from public.game_players gp where gp.game_id=p_game_id and gp.user_id=me),
    'control_user_id',bg.control_user_id,'active_cell_id',bg.active_cell_id,'buzz_user_id',bg.buzz_user_id,'active_wager',bg.active_wager,
    'clue_opened_at',bg.clue_opened_at,'buzz_opened_at',bg.buzz_opened_at,'answer_started_at',bg.answer_started_at,'reveal_started_at',bg.reveal_started_at,
    'final_category',bg.final_category,'final_clue_started_at',bg.final_clue_started_at,'updated_at',bg.updated_at,'answer_display',answer_display,'question',active_question,
    'cells',(select coalesce(jsonb_agg(jsonb_build_object('id',bc.id,'col',bc.col_index,'row',bc.row_index,'category',bc.category,'value',bc.clue_value,'used',bc.is_used,
      'special',case when bc.is_used or bc.id=bg.active_cell_id then bc.special_kind else 'normal' end) order by bc.row_index,bc.col_index),'[]'::jsonb) from public.board_cells bc where bc.game_id=p_game_id),
    'players',(select coalesce(jsonb_agg(jsonb_build_object('user_id',gp.user_id,'username',pr.username,'avatar_url',pr.avatar_url,'score',gp.total_score,
      'xp_awarded',gp.xp_awarded,'is_me',gp.user_id=me,'is_host',gp.user_id=g.host_id,'is_control',gp.user_id=bg.control_user_id,
      'is_buzzed',gp.user_id=bg.buzz_user_id,'locked_out',exists(select 1 from public.board_lockouts bl where bl.game_id=p_game_id and bl.cell_id=bg.active_cell_id and bl.user_id=gp.user_id),
      'final_wagered',exists(select 1 from public.board_final_entries fe where fe.game_id=p_game_id and fe.user_id=gp.user_id),
      'final_answered',exists(select 1 from public.board_final_entries fe where fe.game_id=p_game_id and fe.user_id=gp.user_id and fe.answered_at is not null),
      'final_wager',case when gp.user_id=me or phase_text='finished' then (select fe.wager from public.board_final_entries fe where fe.game_id=p_game_id and fe.user_id=gp.user_id) else null end,
      'final_correct',case when phase_text='finished' then (select fe.is_correct from public.board_final_entries fe where fe.game_id=p_game_id and fe.user_id=gp.user_id) else null end,
      'final_delta',case when phase_text='finished' then (select fe.score_delta from public.board_final_entries fe where fe.game_id=p_game_id and fe.user_id=gp.user_id) else null end
    ) order by gp.total_score desc,gp.joined_at asc),'[]'::jsonb)
      from public.game_players gp join public.profiles pr on pr.user_id=gp.user_id where gp.game_id=p_game_id and gp.participation_status='active'),
    'attempts',(select coalesce(jsonb_agg(jsonb_build_object('user_id',ba.user_id,'username',pr.username,'correct',ba.is_correct,'delta',ba.score_delta,'answer',case when phase_text='reveal' then ba.answer_value else null end)
      order by ba.submitted_at),'[]'::jsonb) from public.board_answers ba join public.profiles pr on pr.user_id=ba.user_id where ba.game_id=p_game_id and ba.cell_id=bg.active_cell_id),
    'my_max_double_wager',(select greatest(2000,coalesce(gp.total_score,0)) from public.game_players gp where gp.game_id=p_game_id and gp.user_id=me),
    'my_max_final_wager',(select greatest(0,coalesce(gp.total_score,0)) from public.game_players gp where gp.game_id=p_game_id and gp.user_id=me)
  );
  return result;
end $$;
revoke all on function public.get_board_state_v23(uuid) from public,anon;
grant execute on function public.get_board_state_v23(uuid) to authenticated;

create or replace function public.reset_board_lobby_v23(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare g public.games;
begin
  select * into g from public.games where id=p_game_id for update;
  if g.id is null or g.experience_mode<>'board' then raise exception 'Board game not found'; end if;
  if not public._board_is_participant_v23(p_game_id,auth.uid()) then raise exception 'Not a participant'; end if;
  if g.status='lobby' then return; end if;
  if g.status<>'finished' then raise exception 'Game is not finished'; end if;
  if g.host_id<>auth.uid() and now()<coalesce(g.finished_at,now())+interval '8 seconds' then raise exception 'Results are still on screen'; end if;
  delete from public.board_lockouts where game_id=p_game_id;
  delete from public.board_answers where game_id=p_game_id;
  delete from public.board_final_entries where game_id=p_game_id;
  delete from public.board_cells where game_id=p_game_id;
  delete from public.game_questions where game_id=p_game_id;
  update public.game_players set total_score=0,xp_awarded=0,participation_status='active',joined_cycle=g.cycle_no+1 where game_id=p_game_id;
  update public.board_games set phase='lobby',control_user_id=null,active_cell_id=null,buzz_user_id=null,active_wager=0,
    clue_opened_at=null,buzz_opened_at=null,answer_started_at=null,reveal_started_at=null,final_question_id=null,final_category=null,final_clue_started_at=null,updated_at=now()
    where game_id=p_game_id;
  update public.games set status='lobby',current_question_index=0,question_started_at=null,results_started_at=null,finished_at=null,rewards_awarded_at=null,
    library_session_id=null,cycle_no=cycle_no+1,last_activity_at=now() where id=p_game_id;
end $$;
revoke all on function public.reset_board_lobby_v23(uuid) from public,anon;
grant execute on function public.reset_board_lobby_v23(uuid) to authenticated;

-- Finished boards are already snapshotted into the compact Replay Library. When
-- lifecycle maintenance later closes an empty finished room, discard the board's
-- transient clue/answer state immediately instead of retaining it for months.
create or replace function public.cleanup_closed_board_runtime_v23()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.experience_mode='board' and new.status='cancelled' and old.status is distinct from new.status and new.library_session_id is not null then
    delete from public.board_lockouts where game_id=new.id;
    delete from public.board_answers where game_id=new.id;
    delete from public.board_final_entries where game_id=new.id;
    delete from public.board_cells where game_id=new.id;
    delete from public.board_games where game_id=new.id;
  end if;
  return new;
end $$;
revoke all on function public.cleanup_closed_board_runtime_v23() from public,anon,authenticated;
drop trigger if exists cleanup_closed_board_runtime_v23 on public.games;
create trigger cleanup_closed_board_runtime_v23 after update of status on public.games
for each row execute function public.cleanup_closed_board_runtime_v23();

-- V23 lobby reader: same multiplayer shell plus experience_mode so the client can
-- route Board Battle rooms without disturbing standard estimation rooms.
create or replace function public.get_lobby_v23(p_code text)
returns table(
  id uuid,code text,host_id uuid,title text,category text,difficulty text,question_count int,max_players int,game_mode text,seconds_per_question int,
  status text,current_question_index int,question_started_at timestamptz,results_started_at timestamptz,finished_at timestamptz,rewards_awarded_at timestamptz,
  visibility text,allow_matchmaking boolean,lobby_kind text,matchmaking_target int,cycle_no int,my_participation_status text,human_count bigint,bot_count bigint,player_count bigint,
  experience_mode text
) language sql security definer set search_path=public as $$
  select g.id,g.code,g.host_id,g.title,g.category,g.difficulty,g.question_count,g.max_players,g.game_mode,g.seconds_per_question,
    g.status,g.current_question_index,g.question_started_at,g.results_started_at,g.finished_at,g.rewards_awarded_at,
    g.visibility,g.allow_matchmaking,g.lobby_kind,g.matchmaking_target,g.cycle_no,
    (select gp.participation_status from public.game_players gp where gp.game_id=g.id and gp.user_id=auth.uid()),
    (select count(*) from public.game_players gp where gp.game_id=g.id),
    (select count(*) from public.game_bots gb where gb.game_id=g.id),
    (select count(*) from public.game_players gp where gp.game_id=g.id)+(select count(*) from public.game_bots gb where gb.game_id=g.id),
    coalesce(g.experience_mode,'estimate')
  from public.games g where g.code=upper(trim(p_code)) and (
    g.visibility='public' or g.status='lobby' or g.host_id=auth.uid() or exists(select 1 from public.game_players gp where gp.game_id=g.id and gp.user_id=auth.uid())
  );
$$;
revoke all on function public.get_lobby_v23(text) from public;
grant execute on function public.get_lobby_v23(text) to anon,authenticated;

-- Keep the admin/live-ops lifecycle informed by board activity. The base games
-- row is touched on every board transition, so existing realtime subscriptions
-- and stale-room sweeps continue to work.

select
  to_regclass('public.board_games') is not null as board_games_table,
  to_regclass('public.board_cells') is not null as board_cells_table,
  to_regprocedure('public.create_board_lobby_v23(text[],integer,integer,text,text)') is not null as create_rpc,
  to_regprocedure('public.get_board_state_v23(uuid)') is not null as state_rpc,
  case when to_regclass('public.board_games') is not null and to_regprocedure('public.get_board_state_v23(uuid)') is not null then 'READY' else 'CHECK' end as schema_status;
