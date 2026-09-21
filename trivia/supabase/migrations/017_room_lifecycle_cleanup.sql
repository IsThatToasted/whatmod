-- WhatMod Trivia V17 - conservative stale room + presence lifecycle cleanup
-- Purpose:
--   * keep active player-created and matchmaking rooms untouched while humans are present
--   * expire genuinely abandoned lobbies/matches on conservative phase-aware timers
--   * prune stale presence rows and keep game_players.is_connected honest
--   * run automatically from the existing V15 presence heartbeat, throttled server-side
--   * give admins a manual sweep + lifecycle status in Live Ops

begin;

-- -----------------------------------------------------------------------------
-- Schema prerequisites / lifecycle metadata
-- -----------------------------------------------------------------------------
alter table public.games
  add column if not exists results_started_at timestamptz,
  add column if not exists rewards_awarded_at timestamptz,
  add column if not exists visibility text not null default 'invite_only',
  add column if not exists allow_matchmaking boolean not null default false,
  add column if not exists lobby_kind text not null default 'custom',
  add column if not exists matchmaking_target integer not null default 10,
  add column if not exists cycle_no integer not null default 1,
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists last_human_seen_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists close_reason text;

alter table public.game_players
  add column if not exists participation_status text not null default 'active',
  add column if not exists joined_cycle integer not null default 1,
  add column if not exists xp_awarded integer not null default 0;

create table if not exists public.game_bots (
  game_id uuid not null references public.games(id) on delete cascade,
  bot_id uuid not null default gen_random_uuid(),
  username text not null,
  skill numeric not null default .55,
  total_score integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (game_id,bot_id)
);

create index if not exists games_lifecycle_status_activity_idx
  on public.games(status,last_activity_at);
create index if not exists games_lifecycle_human_seen_idx
  on public.games(last_human_seen_at desc);

-- Backfill sensible activity timestamps for rooms created before V17.
update public.games g
set last_activity_at = greatest(
  g.created_at,
  coalesce(g.question_started_at,g.created_at),
  coalesce(g.results_started_at,g.created_at),
  coalesce(g.finished_at,g.created_at)
);

-- Presence is created here too so V17 is safe on projects where V15 only
-- partially landed.
create table if not exists public.trivia_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  page text,
  game_id uuid references public.games(id) on delete set null,
  client_id text
);
create index if not exists trivia_presence_seen_idx on public.trivia_presence(last_seen_at desc);
create index if not exists trivia_presence_game_idx on public.trivia_presence(game_id,last_seen_at desc);
alter table public.trivia_presence enable row level security;
revoke all on public.trivia_presence from public,anon,authenticated;

update public.games g
set last_human_seen_at = x.last_seen
from (
  select p.game_id,max(p.last_seen_at) as last_seen
  from public.trivia_presence p
  where p.game_id is not null
  group by p.game_id
) x
where g.id=x.game_id;

-- One tiny row throttles maintenance across every connected browser.
create table if not exists public.trivia_maintenance_state (
  maintenance_key text primary key,
  last_run_at timestamptz,
  last_result jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.trivia_maintenance_state enable row level security;
revoke all on public.trivia_maintenance_state from public,anon,authenticated;
insert into public.trivia_maintenance_state(maintenance_key,last_run_at,last_result)
values('room_lifecycle',null,'{}'::jsonb)
on conflict(maintenance_key) do nothing;

-- -----------------------------------------------------------------------------
-- Internal sweep. These timeouts are intentionally conservative:
--   active question/results: 20m matchmaking, 30m custom with ZERO live humans
--   finished room:            20m with ZERO live humans
--   empty matchmaking lobby:  30m
--   empty public custom lobby: 90m
--   empty invite-only lobby:   4h
-- A human heartbeat inside the room always refreshes last_activity_at and wins
-- over age, so an old-but-active room is never closed simply because it is old.
-- -----------------------------------------------------------------------------
create or replace function public._perform_room_lifecycle_sweep_v17()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_now timestamptz := now();
  v_presence_pruned integer := 0;
  v_connections_offline integer := 0;
  v_rooms_closed integer := 0;
  v_matchmaking_closed integer := 0;
  v_custom_closed integer := 0;
  v_finished_closed integer := 0;
  v_active_closed integer := 0;
  v_lobby_closed integer := 0;
  v_result jsonb;
begin
  -- Very old presence rows are observability noise; "online" itself is <=90s.
  delete from public.trivia_presence p
  where p.last_seen_at < v_now - interval '12 hours';
  get diagnostics v_presence_pruned = row_count;

  -- Keep the legacy connection flag useful without depending on it for room
  -- lifecycle decisions. A player is connected only when that exact game has a
  -- recent heartbeat.
  update public.game_players gp
  set is_connected = false
  where gp.is_connected = true
    and not exists(
      select 1 from public.trivia_presence p
      where p.user_id=gp.user_id
        and p.game_id=gp.game_id
        and p.last_seen_at >= v_now - interval '2 minutes'
    );
  get diagnostics v_connections_offline = row_count;

  update public.game_players gp
  set is_connected = true
  where gp.is_connected = false
    and exists(
      select 1 from public.trivia_presence p
      where p.user_id=gp.user_id
        and p.game_id=gp.game_id
        and p.last_seen_at >= v_now - interval '2 minutes'
    );

  -- Close only rooms with zero recent human heartbeats. Bots never keep a room
  -- alive. This protects slow/long-running human rooms regardless of age.
  with candidates as (
    select
      g.id,
      g.status,
      coalesce(g.lobby_kind,'custom') as lobby_kind,
      coalesce(g.visibility,'invite_only') as visibility,
      coalesce(g.last_activity_at,g.created_at) as activity_at,
      case
        when g.status='finished' then 'finished_idle'
        when g.status in ('question','results') then 'abandoned_match'
        when g.status='lobby' and coalesce(g.lobby_kind,'custom')='matchmaking' then 'empty_matchmaking_lobby'
        when g.status='lobby' and coalesce(g.visibility,'invite_only')='public' then 'empty_public_lobby'
        else 'empty_invite_lobby'
      end as reason
    from public.games g
    where g.status in ('lobby','question','results','finished')
      and not exists(
        select 1 from public.trivia_presence p
        where p.game_id=g.id
          and p.last_seen_at >= v_now - interval '2 minutes'
      )
      and (
        (g.status='finished'
          and coalesce(g.finished_at,g.last_activity_at,g.created_at) < v_now - interval '20 minutes')
        or
        (g.status in ('question','results')
          and coalesce(g.last_activity_at,g.question_started_at,g.results_started_at,g.created_at)
              < v_now - case when coalesce(g.lobby_kind,'custom')='matchmaking'
                            then interval '20 minutes' else interval '30 minutes' end)
        or
        (g.status='lobby' and coalesce(g.lobby_kind,'custom')='matchmaking'
          and coalesce(g.last_activity_at,g.created_at) < v_now - interval '30 minutes')
        or
        (g.status='lobby' and coalesce(g.lobby_kind,'custom')<>'matchmaking'
          and coalesce(g.visibility,'invite_only')='public'
          and coalesce(g.last_activity_at,g.created_at) < v_now - interval '90 minutes')
        or
        (g.status='lobby' and coalesce(g.lobby_kind,'custom')<>'matchmaking'
          and coalesce(g.visibility,'invite_only')<>'public'
          and coalesce(g.last_activity_at,g.created_at) < v_now - interval '4 hours')
      )
  ), closed as (
    update public.games g
    set status='cancelled',
        closed_at=coalesce(g.closed_at,v_now),
        close_reason=case c.reason
          when 'finished_idle' then 'Automatically closed after finished room remained empty.'
          when 'abandoned_match' then 'Automatically closed after active match lost all players.'
          when 'empty_matchmaking_lobby' then 'Automatically closed abandoned matchmaking lobby.'
          when 'empty_public_lobby' then 'Automatically closed empty public lobby.'
          else 'Automatically closed empty invite-only lobby.'
        end,
        last_activity_at=v_now
    from candidates c
    where g.id=c.id
    returning g.id,c.status,c.lobby_kind,c.reason
  )
  select
    count(*),
    count(*) filter(where lobby_kind='matchmaking'),
    count(*) filter(where lobby_kind<>'matchmaking'),
    count(*) filter(where status='finished'),
    count(*) filter(where status in ('question','results')),
    count(*) filter(where status='lobby')
  into v_rooms_closed,v_matchmaking_closed,v_custom_closed,v_finished_closed,v_active_closed,v_lobby_closed
  from closed;

  v_result := jsonb_build_object(
    'ran_at',v_now,
    'presence_rows_pruned',v_presence_pruned,
    'connections_marked_offline',v_connections_offline,
    'rooms_closed',v_rooms_closed,
    'matchmaking_rooms_closed',v_matchmaking_closed,
    'custom_rooms_closed',v_custom_closed,
    'finished_rooms_closed',v_finished_closed,
    'abandoned_active_rooms_closed',v_active_closed,
    'empty_lobbies_closed',v_lobby_closed,
    'policy',jsonb_build_object(
      'online_window_seconds',120,
      'matchmaking_active_timeout_minutes',20,
      'custom_active_timeout_minutes',30,
      'finished_timeout_minutes',20,
      'matchmaking_lobby_timeout_minutes',30,
      'public_lobby_timeout_minutes',90,
      'invite_lobby_timeout_minutes',240,
      'automatic_sweep_interval_minutes',5
    )
  );

  update public.trivia_maintenance_state
  set last_run_at=v_now,last_result=v_result,updated_at=v_now
  where maintenance_key='room_lifecycle';

  return v_result;
end $$;
revoke all on function public._perform_room_lifecycle_sweep_v17() from public,anon,authenticated;

create or replace function public._maybe_room_lifecycle_sweep_v17()
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_claimed boolean := false;
begin
  -- Only one request can own the sweep transaction at a time.
  if not pg_try_advisory_xact_lock(hashtext('whatmod_trivia_room_lifecycle_v17')) then return; end if;

  update public.trivia_maintenance_state m
  set last_run_at=now(),updated_at=now()
  where m.maintenance_key='room_lifecycle'
    and (m.last_run_at is null or m.last_run_at < now()-interval '5 minutes')
  returning true into v_claimed;

  if coalesce(v_claimed,false) then
    perform public._perform_room_lifecycle_sweep_v17();
  end if;
end $$;
revoke all on function public._maybe_room_lifecycle_sweep_v17() from public,anon,authenticated;

-- -----------------------------------------------------------------------------
-- Upgrade the existing heartbeat in place. No frontend change is needed.
-- Heartbeats refresh the room only when the signed-in user is actually a human
-- participant in that game. They also opportunistically trigger the throttled
-- lifecycle sweep.
-- -----------------------------------------------------------------------------
create or replace function public.touch_trivia_presence_v15(
  p_page text default null,
  p_game_id uuid default null,
  p_client_id text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then return; end if;

  -- Ignore an invalid/spoofed game id rather than letting it keep arbitrary
  -- rooms alive.
  if p_game_id is not null and not exists(
    select 1 from public.game_players gp
    where gp.game_id=p_game_id and gp.user_id=auth.uid()
  ) then
    p_game_id := null;
  end if;

  insert into public.trivia_presence(user_id,first_seen_at,last_seen_at,page,game_id,client_id)
  values(auth.uid(),now(),now(),left(nullif(trim(p_page),''),80),p_game_id,left(nullif(trim(p_client_id),''),120))
  on conflict(user_id) do update set
    last_seen_at=now(),
    page=excluded.page,
    game_id=excluded.game_id,
    client_id=coalesce(excluded.client_id,public.trivia_presence.client_id);

  if p_game_id is not null then
    update public.game_players gp set is_connected=true
    where gp.game_id=p_game_id and gp.user_id=auth.uid();

    update public.games g
    set last_activity_at=now(),last_human_seen_at=now()
    where g.id=p_game_id and g.status<>'cancelled';
  end if;

  perform public._maybe_room_lifecycle_sweep_v17();
end $$;
revoke all on function public.touch_trivia_presence_v15(text,uuid,text) from public,anon;
grant execute on function public.touch_trivia_presence_v15(text,uuid,text) to authenticated;

create or replace function public.clear_trivia_presence_v15()
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_game_id uuid;
begin
  if auth.uid() is null then return; end if;
  select p.game_id into v_game_id from public.trivia_presence p where p.user_id=auth.uid();
  delete from public.trivia_presence p where p.user_id=auth.uid();
  if v_game_id is not null then
    update public.game_players gp set is_connected=false
    where gp.game_id=v_game_id and gp.user_id=auth.uid();
  end if;
end $$;
revoke all on function public.clear_trivia_presence_v15() from public,anon;
grant execute on function public.clear_trivia_presence_v15() to authenticated;

-- Admin-only force sweep and status endpoints.
create or replace function public.admin_run_room_lifecycle_sweep_v17()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_result jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  perform pg_advisory_xact_lock(hashtext('whatmod_trivia_room_lifecycle_v17'));
  v_result := public._perform_room_lifecycle_sweep_v17();
  return v_result;
end $$;
revoke all on function public.admin_run_room_lifecycle_sweep_v17() from public,anon;
grant execute on function public.admin_run_room_lifecycle_sweep_v17() to authenticated;

create or replace function public.admin_room_lifecycle_status_v17()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_state public.trivia_maintenance_state%rowtype;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select * into v_state from public.trivia_maintenance_state where maintenance_key='room_lifecycle';
  return jsonb_build_object(
    'last_run_at',v_state.last_run_at,
    'last_result',coalesce(v_state.last_result,'{}'::jsonb),
    'stale_presence_rows',(select count(*) from public.trivia_presence where last_seen_at<now()-interval '12 hours'),
    'rooms_with_no_recent_humans',(
      select count(*) from public.games g
      where g.status in('lobby','question','results','finished')
        and not exists(select 1 from public.trivia_presence p where p.game_id=g.id and p.last_seen_at>=now()-interval '2 minutes')
    )
  );
end $$;
revoke all on function public.admin_room_lifecycle_status_v17() from public,anon;
grant execute on function public.admin_room_lifecycle_status_v17() to authenticated;

-- Add lifecycle metadata to the existing Live Ops payload while preserving all
-- V15 fields and client compatibility.
create or replace function public.admin_live_operations_v15()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare out_json jsonb; lifecycle jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  perform public._maybe_room_lifecycle_sweep_v17();
  lifecycle := public.admin_room_lifecycle_status_v17();

  with online as (
    select p.* from public.trivia_presence p
    where p.last_seen_at >= now()-interval '90 seconds'
  ), game_rows as (
    select g.*
    from public.games g
    where g.status in ('lobby','question','results')
       or exists(select 1 from online o where o.game_id=g.id)
  ), game_json as (
    select jsonb_build_object(
      'id',g.id,'code',g.code,'title',coalesce(g.title,'Trivia Party'),'status',g.status,
      'visibility',coalesce(g.visibility,'invite_only'),'allow_matchmaking',coalesce(g.allow_matchmaking,false),
      'lobby_kind',coalesce(g.lobby_kind,'custom'),'cycle_no',coalesce(g.cycle_no,1),
      'category',g.category,'difficulty',g.difficulty,'question_count',g.question_count,
      'current_question_index',g.current_question_index,'seconds_per_question',g.seconds_per_question,
      'question_started_at',g.question_started_at,'results_started_at',g.results_started_at,'created_at',g.created_at,
      'last_activity_at',g.last_activity_at,'last_human_seen_at',g.last_human_seen_at,
      'current_question',(
        select q.prompt from public.game_questions gq join public.questions q on q.id=gq.question_id
        where gq.game_id=g.id and gq.ordinal=g.current_question_index limit 1
      ),
      'human_count',(select count(*) from public.game_players gp where gp.game_id=g.id),
      'online_human_count',(
        select count(*) from public.game_players gp join online o on o.user_id=gp.user_id
        where gp.game_id=g.id and o.game_id=g.id
      ),
      'spectator_count',(select count(*) from public.game_players gp where gp.game_id=g.id and gp.participation_status='spectator'),
      'bot_count',(select count(*) from public.game_bots gb where gb.game_id=g.id),
      'players',coalesce((
        select jsonb_agg(player order by sort_key,username)
        from (
          select jsonb_build_object(
            'user_id',gp.user_id,'username',pr.username,'avatar_url',pr.avatar_url,'is_bot',false,
            'participation_status',gp.participation_status,'total_score',gp.total_score,
            'online',(o.user_id is not null and o.game_id=g.id),'last_seen_at',o.last_seen_at,'page',o.page,
            'joined_at',gp.joined_at
          ) player,
          case when gp.participation_status='active' then 0 else 1 end sort_key,
          pr.username
          from public.game_players gp
          join public.profiles pr on pr.user_id=gp.user_id
          left join online o on o.user_id=gp.user_id
          where gp.game_id=g.id
          union all
          select jsonb_build_object(
            'user_id',gb.bot_id,'username',gb.username,'avatar_url',null,'is_bot',true,
            'participation_status','active','total_score',gb.total_score,
            'online',true,'last_seen_at',null,'page','bot','joined_at',gb.joined_at
          ),2,gb.username
          from public.game_bots gb where gb.game_id=g.id
        ) roster
      ),'[]'::jsonb)
    ) as obj
    from game_rows g
    order by case g.status when 'question' then 0 when 'results' then 1 else 2 end,g.created_at desc
  ), online_json as (
    select jsonb_build_object(
      'user_id',o.user_id,'username',pr.username,'avatar_url',pr.avatar_url,'page',o.page,
      'last_seen_at',o.last_seen_at,'first_seen_at',o.first_seen_at,'game_id',o.game_id,
      'game_code',g.code,'game_title',g.title,'game_status',g.status
    ) as obj
    from online o
    join public.profiles pr on pr.user_id=o.user_id
    left join public.games g on g.id=o.game_id
    order by o.last_seen_at desc
  )
  select jsonb_build_object(
    'generated_at',now(),
    'online_count',(select count(*) from online),
    'live_game_count',(select count(*) from game_rows),
    'online_users',coalesce((select jsonb_agg(obj) from online_json),'[]'::jsonb),
    'games',coalesce((select jsonb_agg(obj) from game_json),'[]'::jsonb),
    'lifecycle',lifecycle
  ) into out_json;

  return out_json;
end $$;
revoke all on function public.admin_live_operations_v15() from public,anon;
grant execute on function public.admin_live_operations_v15() to authenticated;

-- Run one conservative cleanup immediately so existing ghost rooms disappear
-- as part of the V17 migration instead of waiting for the next heartbeat.
do $$
begin
  perform public._perform_room_lifecycle_sweep_v17();
end $$;

commit;

-- Verification. Expected schema_status = READY.
with required_columns(table_name,column_name) as (
  values
    ('games','last_activity_at'),('games','last_human_seen_at'),('games','closed_at'),('games','close_reason'),
    ('trivia_presence','last_seen_at'),('trivia_maintenance_state','last_run_at')
), missing_columns as (
  select r.* from required_columns r
  where not exists(
    select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name=r.table_name and c.column_name=r.column_name
  )
), required_rpcs(name) as (
  values ('admin_run_room_lifecycle_sweep_v17'),('admin_room_lifecycle_status_v17'),('touch_trivia_presence_v15')
), missing_rpcs as (
  select r.name from required_rpcs r
  where not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=r.name)
)
select
  coalesce((select jsonb_agg(to_jsonb(m)) from missing_columns m),'[]'::jsonb) as missing_columns,
  coalesce((select jsonb_agg(name) from missing_rpcs),'[]'::jsonb) as missing_rpcs,
  case when not exists(select 1 from missing_columns) and not exists(select 1 from missing_rpcs) then 'READY' else 'NEEDS_ATTENTION' end as schema_status;
