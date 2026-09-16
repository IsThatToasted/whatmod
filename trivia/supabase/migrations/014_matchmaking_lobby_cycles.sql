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
