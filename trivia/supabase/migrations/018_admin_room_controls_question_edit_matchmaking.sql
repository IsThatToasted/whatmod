-- WhatMod Trivia V18 - admin room controls, question edit packs, filtered matchmaking
-- Safe additive migration for V17/V14.2+ databases.

alter table public.games add column if not exists last_activity_at timestamptz not null default now();
alter table public.games add column if not exists last_human_seen_at timestamptz;
alter table public.games add column if not exists closed_at timestamptz;
alter table public.games add column if not exists close_reason text;
alter table public.games add column if not exists results_started_at timestamptz;
alter table public.games add column if not exists rewards_awarded_at timestamptz;
alter table public.games add column if not exists cycle_no int not null default 1;
alter table public.games add column if not exists visibility text not null default 'invite_only';
alter table public.games add column if not exists allow_matchmaking boolean not null default false;
alter table public.games add column if not exists lobby_kind text not null default 'custom';
alter table public.games add column if not exists matchmaking_target int not null default 10;

alter table public.game_players add column if not exists participation_status text not null default 'active';
alter table public.game_players add column if not exists joined_cycle int not null default 1;
alter table public.game_players add column if not exists xp_awarded int not null default 0;
alter table public.game_players add column if not exists is_connected boolean not null default true;

alter table public.questions add column if not exists updated_at timestamptz not null default now();
alter table public.questions add column if not exists content_locked boolean not null default false;
alter table public.questions add column if not exists media_query text;

create table if not exists public.room_admin_actions (
  id bigint generated always as identity primary key,
  game_id uuid,
  game_code text,
  action text not null check(action in ('shutdown','reset')),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_username text,
  actor_email text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists room_admin_actions_game_idx on public.room_admin_actions(game_id,created_at desc);
revoke all on public.room_admin_actions from public,anon,authenticated;

create or replace function public._audit_room_admin_v18(
  p_game_id uuid,
  p_code text,
  p_action text,
  p_before jsonb,
  p_after jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path=public as $$
declare actor_name text; actor_mail text;
begin
  select p.username into actor_name from public.profiles p where p.user_id=auth.uid();
  select u.email into actor_mail from auth.users u where u.id=auth.uid();
  insert into public.room_admin_actions(game_id,game_code,action,actor_user_id,actor_username,actor_email,before_data,after_data,metadata)
  values(p_game_id,p_code,p_action,auth.uid(),actor_name,actor_mail,p_before,p_after,coalesce(p_metadata,'{}'::jsonb));
end $$;
revoke all on function public._audit_room_admin_v18(uuid,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated;

create or replace function public.admin_room_health_v18(p_game_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  g public.games;
  human_count int:=0;
  online_count int:=0;
  current_loaded boolean:=false;
  seconds_activity int:=0;
  seconds_human int:=0;
  seconds_phase int:=0;
  score int:=100;
  state text:='healthy';
  reasons jsonb:='[]'::jsonb;
  phase_start timestamptz;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select gg.* into g from public.games gg where gg.id=p_game_id;
  if g.id is null then raise exception 'Room not found'; end if;

  select count(*) into human_count from public.game_players gp where gp.game_id=g.id;
  select count(*) into online_count
  from public.game_players gp
  join public.trivia_presence tp on tp.user_id=gp.user_id and tp.game_id=g.id
  where gp.game_id=g.id and tp.last_seen_at>=now()-interval '90 seconds';

  current_loaded := exists(select 1 from public.game_questions gq where gq.game_id=g.id and gq.ordinal=g.current_question_index);
  seconds_activity := greatest(0,extract(epoch from (now()-coalesce(g.last_activity_at,g.created_at)))::int);
  seconds_human := greatest(0,extract(epoch from (now()-coalesce(g.last_human_seen_at,g.created_at)))::int);
  phase_start := case when g.status='question' then g.question_started_at when g.status='results' then g.results_started_at when g.status='finished' then g.finished_at else g.last_activity_at end;
  seconds_phase := case when phase_start is null then 0 else greatest(0,extract(epoch from (now()-phase_start))::int) end;

  if g.status='cancelled' then state:='closed'; score:=0; reasons:=reasons||jsonb_build_array('Room is cancelled/closed');
  elsif human_count=0 then state:='critical'; score:=15; reasons:=reasons||jsonb_build_array('No human participants remain in the room');
  end if;

  if g.status in ('question','results') and not current_loaded then
    state:='stuck'; score:=least(score,20); reasons:=reasons||jsonb_build_array('Current round has no question loaded');
  end if;
  if g.status='question' and g.question_started_at is null then
    state:='stuck'; score:=least(score,15); reasons:=reasons||jsonb_build_array('Question phase has no start timestamp');
  elsif g.status='question' and seconds_phase>coalesce(g.seconds_per_question,20)+25 then
    state:='stuck'; score:=least(score,25); reasons:=reasons||jsonb_build_array('Question phase is well past its timer');
  end if;
  if g.status='results' and g.results_started_at is null then
    state:='stuck'; score:=least(score,15); reasons:=reasons||jsonb_build_array('Results phase has no start timestamp');
  elsif g.status='results' and seconds_phase>35 then
    state:='stuck'; score:=least(score,30); reasons:=reasons||jsonb_build_array('Results phase has not advanced');
  end if;

  if human_count>0 and online_count=0 and g.status in ('lobby','question','results') then
    if state='healthy' then state:='warning'; end if;
    score:=least(score,65); reasons:=reasons||jsonb_build_array('No participants have a recent online heartbeat');
  end if;
  if seconds_human>600 and g.status in ('lobby','question','results') then
    if state in ('healthy','warning') then state:='stale'; end if;
    score:=least(score,45); reasons:=reasons||jsonb_build_array('No recent human activity for more than 10 minutes');
  end if;
  if seconds_activity>900 and g.status in ('question','results') then
    if state in ('healthy','warning') then state:='stale'; end if;
    score:=least(score,40); reasons:=reasons||jsonb_build_array('Room state has not changed for more than 15 minutes');
  end if;

  return jsonb_build_object(
    'state',state,'score',greatest(0,least(100,score)),'reasons',reasons,
    'human_count',human_count,'online_count',online_count,
    'seconds_since_activity',seconds_activity,'seconds_since_human',seconds_human,'seconds_in_phase',seconds_phase,
    'current_question_loaded',current_loaded
  );
end $$;
revoke all on function public.admin_room_health_v18(uuid) from public,anon;
grant execute on function public.admin_room_health_v18(uuid) to authenticated;

create or replace function public.admin_shutdown_room_v18(p_game_id uuid,p_reason text default 'Manual admin shutdown')
returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.games; before_j jsonb; after_j jsonb; removed_humans int:=0; removed_bots int:=0; roster jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select gg.* into g from public.games gg where gg.id=p_game_id for update;
  if g.id is null then raise exception 'Room not found'; end if;
  before_j:=to_jsonb(g);
  select coalesce(jsonb_agg(jsonb_build_object('user_id',gp.user_id,'status',gp.participation_status,'score',gp.total_score)),'[]'::jsonb),count(*)
    into roster,removed_humans from public.game_players gp where gp.game_id=g.id;
  select count(*) into removed_bots from public.game_bots gb where gb.game_id=g.id;

  update public.trivia_presence tp set game_id=null,last_seen_at=now() where tp.game_id=g.id;
  delete from public.game_bot_answers where game_id=g.id;
  delete from public.game_bots where game_id=g.id;
  delete from public.game_players where game_id=g.id;
  update public.games gg set status='cancelled',closed_at=now(),close_reason=coalesce(nullif(trim(p_reason),''),'Manual admin shutdown'),
    last_activity_at=now(),finished_at=coalesce(gg.finished_at,now()),question_started_at=null,results_started_at=null
  where gg.id=g.id returning to_jsonb(gg) into after_j;

  perform public._audit_room_admin_v18(g.id,g.code,'shutdown',before_j,after_j,jsonb_build_object('removed_humans',removed_humans,'removed_bots',removed_bots,'roster',roster,'reason',p_reason));
  return jsonb_build_object('ok',true,'code',g.code,'removed_humans',removed_humans,'removed_bots',removed_bots,'status','cancelled');
end $$;
revoke all on function public.admin_shutdown_room_v18(uuid,text) from public,anon;
grant execute on function public.admin_shutdown_room_v18(uuid,text) to authenticated;

create or replace function public.admin_reset_room_v18(p_game_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.games; before_j jsonb; after_j jsonb; new_host uuid; online_host uuid; humans int:=0;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select gg.* into g from public.games gg where gg.id=p_game_id for update;
  if g.id is null then raise exception 'Room not found'; end if;
  if g.status='cancelled' then raise exception 'Closed rooms cannot be reset because their player roster has been removed'; end if;
  select count(*) into humans from public.game_players gp where gp.game_id=g.id;
  if humans=0 then raise exception 'There are no human players to preserve. Shut the room down instead.'; end if;
  before_j:=to_jsonb(g);

  select gp.user_id into online_host
  from public.game_players gp
  left join public.trivia_presence tp on tp.user_id=gp.user_id and tp.game_id=g.id and tp.last_seen_at>=now()-interval '90 seconds'
  where gp.game_id=g.id
  order by (tp.user_id is not null) desc,case when gp.user_id=g.host_id then 0 else 1 end,gp.joined_at asc
  limit 1;
  new_host:=coalesce(online_host,g.host_id);

  delete from public.game_answers where game_id=g.id;
  delete from public.game_bot_answers where game_id=g.id;
  delete from public.game_bots where game_id=g.id;
  delete from public.game_questions where game_id=g.id;
  update public.game_players gp set total_score=0,xp_awarded=0,participation_status='active',joined_cycle=g.cycle_no+1,
    is_connected=exists(select 1 from public.trivia_presence tp where tp.user_id=gp.user_id and tp.game_id=g.id and tp.last_seen_at>=now()-interval '2 minutes')
  where gp.game_id=g.id;
  update public.games gg set host_id=new_host,status='lobby',current_question_index=0,question_started_at=null,results_started_at=null,
    finished_at=null,rewards_awarded_at=null,library_session_id=null,cycle_no=gg.cycle_no+1,closed_at=null,close_reason=null,
    last_activity_at=now(),last_human_seen_at=now()
  where gg.id=g.id returning to_jsonb(gg) into after_j;

  perform public._audit_room_admin_v18(g.id,g.code,'reset',before_j,after_j,jsonb_build_object('preserved_humans',humans,'new_host_id',new_host));
  return jsonb_build_object('ok',true,'code',g.code,'status','lobby','player_count',humans,'host_id',new_host,'cycle_no',(after_j->>'cycle_no')::int);
end $$;
revoke all on function public.admin_reset_room_v18(uuid) from public,anon;
grant execute on function public.admin_reset_room_v18(uuid) to authenticated;

-- Full edit-pack export. The client pages through this RPC so very large banks
-- do not require a single huge PostgREST response.
create or replace function public.admin_export_questions_for_edit_v18(
  p_search text default null,p_category text default null,p_difficulty text default 'any',p_status text default 'active',p_source text default null,
  p_limit int default 500,p_offset int default 0
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare out_json jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  with vote_totals as (
    select v.question_id,count(*) filter(where v.vote=1)::bigint upvotes,count(*) filter(where v.vote=-1)::bigint downvotes
    from public.question_votes v group by v.question_id
  ), filtered as (
    select q.id,q.canonical_key,q.prompt,q.category,q.difficulty,q.question_type,q.context,q.unit,
      q.answer_numeric,q.answer_text,q.options,q.correct_option,q.explanation,q.source_url,q.source_type,q.source_entity_id,q.media_query,q.image_alt,
      q.image_url,q.image_source_url,q.image_attribution,q.image_license,q.image_license_url,q.media_provider,q.media_review_status,
      q.is_active,q.content_locked,q.created_at,q.updated_at,coalesce(v.upvotes,0) upvotes,coalesce(v.downvotes,0) downvotes,
      count(*) over() total_count
    from public.questions q left join vote_totals v on v.question_id=q.id
    where (p_search is null or trim(p_search)='' or q.prompt ilike '%'||trim(p_search)||'%' or coalesce(q.media_query,'') ilike '%'||trim(p_search)||'%' or coalesce(q.canonical_key,'') ilike '%'||trim(p_search)||'%')
      and (p_category is null or p_category='' or q.category=p_category)
      and (p_difficulty is null or p_difficulty='' or p_difficulty='any' or q.difficulty=p_difficulty)
      and (p_status='all' or (p_status='active' and q.is_active) or (p_status='retired' and not q.is_active and not coalesce(q.photo_disabled,false)) or (p_status='photo_disabled' and coalesce(q.photo_disabled,false)) or (p_status='missing_photo' and q.is_active and not public.question_has_valid_photo_v15(q.id)))
      and (p_source is null or p_source='' or coalesce(q.source_type,'manual')=p_source)
    order by q.is_active desc,q.updated_at desc,q.created_at desc
    limit greatest(1,least(1000,coalesce(p_limit,500))) offset greatest(0,coalesce(p_offset,0))
  )
  select jsonb_build_object('total',coalesce(max(f.total_count),0),'items',coalesce(jsonb_agg(to_jsonb(f)-'total_count'),'[]'::jsonb)) into out_json from filtered f;
  return out_json;
end $$;
revoke all on function public.admin_export_questions_for_edit_v18(text,text,text,text,text,int,int) from public,anon;
grant execute on function public.admin_export_questions_for_edit_v18(text,text,text,text,text,int,int) to authenticated;

create or replace function public.admin_import_question_edit_pack_v18(p_questions jsonb,p_batch_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  item jsonb; q public.questions; qid uuid; old_content jsonb; new_content jsonb; after_q jsonb;
  updated_count int:=0; unchanged_count int:=0; missing_count int:=0; failed_count int:=0; errors jsonb:='[]'::jsonb;
  v_prompt text;v_category text;v_difficulty text;v_type text;v_context text;v_unit text;v_answer_numeric numeric;v_answer_text text;v_options jsonb;v_correct int;v_explanation text;v_source_url text;v_media_query text;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  if jsonb_typeof(p_questions)<>'array' then raise exception 'p_questions must be a JSON array'; end if;
  for item in select value from jsonb_array_elements(p_questions)
  loop
    begin
      qid:=null;
      begin qid:=nullif(item->>'id','')::uuid; exception when others then qid:=null; end;
      if qid is not null then select qq.* into q from public.questions qq where qq.id=qid for update; end if;
      if q.id is null and nullif(item->>'canonical_key','') is not null then select qq.* into q from public.questions qq where qq.canonical_key=item->>'canonical_key' for update; end if;
      if q.id is null then missing_count:=missing_count+1; continue; end if;

      v_prompt:=case when item ? 'prompt' then nullif(trim(item->>'prompt'),'') else q.prompt end;
      v_category:=case when item ? 'category' then nullif(trim(item->>'category'),'') else q.category end;
      v_difficulty:=case when item ? 'difficulty' then lower(trim(item->>'difficulty')) else q.difficulty end;
      v_type:=case when item ? 'question_type' then lower(trim(item->>'question_type')) else q.question_type end;
      v_context:=case when item ? 'context' then nullif(trim(item->>'context'),'') else q.context end;
      v_unit:=case when item ? 'unit' then nullif(trim(item->>'unit'),'') else q.unit end;
      v_answer_numeric:=case when item ? 'answer_numeric' then nullif(item->>'answer_numeric','')::numeric else q.answer_numeric end;
      v_answer_text:=case when item ? 'answer_text' then nullif(trim(item->>'answer_text'),'') else q.answer_text end;
      v_options:=case when item ? 'options' then item->'options' else q.options end;
      v_correct:=case when item ? 'correct_option' then nullif(item->>'correct_option','')::int else q.correct_option end;
      v_explanation:=case when item ? 'explanation' then nullif(trim(item->>'explanation'),'') else q.explanation end;
      v_source_url:=case when item ? 'source_url' then nullif(trim(item->>'source_url'),'') else q.source_url end;
      v_media_query:=case when item ? 'media_query' then nullif(trim(item->>'media_query'),'') else q.media_query end;

      if v_prompt is null then raise exception 'Prompt cannot be empty'; end if;
      if v_category is null then raise exception 'Category cannot be empty'; end if;
      if v_difficulty not in ('easy','medium','hard') then raise exception 'Invalid difficulty'; end if;
      if v_type not in ('numeric','multiple_choice','text') then raise exception 'Invalid question type'; end if;
      if v_type='numeric' and v_answer_numeric is null then raise exception 'Numeric question requires answer_numeric'; end if;
      if v_type='text' and v_answer_text is null then raise exception 'Text question requires answer_text'; end if;
      if v_type='multiple_choice' and (v_options is null or jsonb_typeof(v_options)<>'array' or v_correct is null) then raise exception 'Multiple choice question requires options and correct_option'; end if;

      old_content:=jsonb_build_object('prompt',q.prompt,'category',q.category,'difficulty',q.difficulty,'question_type',q.question_type,'context',q.context,'unit',q.unit,'answer_numeric',q.answer_numeric,'answer_text',q.answer_text,'options',q.options,'correct_option',q.correct_option,'explanation',q.explanation,'source_url',q.source_url,'media_query',q.media_query);
      new_content:=jsonb_build_object('prompt',v_prompt,'category',v_category,'difficulty',v_difficulty,'question_type',v_type,'context',v_context,'unit',v_unit,'answer_numeric',v_answer_numeric,'answer_text',v_answer_text,'options',v_options,'correct_option',v_correct,'explanation',v_explanation,'source_url',v_source_url,'media_query',v_media_query);
      if old_content=new_content then unchanged_count:=unchanged_count+1; q:=null; continue; end if;

      update public.questions qq set prompt=v_prompt,category=v_category,difficulty=v_difficulty,question_type=v_type,context=v_context,unit=v_unit,
        answer_numeric=v_answer_numeric,answer_text=v_answer_text,options=v_options,correct_option=v_correct,explanation=v_explanation,source_url=v_source_url,media_query=v_media_query,
        content_locked=true,updated_at=now()
      where qq.id=q.id returning to_jsonb(qq) into after_q;
      perform public._audit_question_admin(q.id,'edit',to_jsonb(q),after_q,jsonb_build_object('origin','question_edit_pack','batch_id',p_batch_id));
      updated_count:=updated_count+1;
      q:=null;
    exception when others then
      failed_count:=failed_count+1;
      errors:=errors||jsonb_build_array(jsonb_build_object('id',item->>'id','prompt',left(coalesce(item->>'prompt',''),120),'error',sqlerrm));
      q:=null;
    end;
  end loop;
  return jsonb_build_object('updated',updated_count,'unchanged',unchanged_count,'missing',missing_count,'failed',failed_count,'errors',errors,'batch_id',p_batch_id);
end $$;
revoke all on function public.admin_import_question_edit_pack_v18(jsonb,uuid) from public,anon;
grant execute on function public.admin_import_question_edit_pack_v18(jsonb,uuid) to authenticated;

create or replace function public.get_matchmaking_options_v18()
returns table(category text,easy_count bigint,medium_count bigint,hard_count bigint)
language sql security definer set search_path=public as $$
  select q.category,
    count(*) filter(where q.difficulty='easy')::bigint,
    count(*) filter(where q.difficulty='medium')::bigint,
    count(*) filter(where q.difficulty='hard')::bigint
  from public.questions q where q.is_active
  group by q.category
  having count(*)>0
  order by q.category;
$$;
revoke all on function public.get_matchmaking_options_v18() from public;
grant execute on function public.get_matchmaking_options_v18() to anon,authenticated;

-- Filtered matchmaking. Only rooms that exactly match the requested category
-- and difficulty are eligible, ensuring the entire match uses that loadout.
create or replace function public.matchmake_v18(p_category text,p_difficulty text)
returns table(code text,join_mode text,created_new boolean) language plpgsql security definer set search_path=public as $$
declare g_rec public.games; c text; tries int:=0; v_category text:=trim(coalesce(p_category,'')); v_difficulty text:=lower(trim(coalesce(p_difficulty,''))); available int:=0;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if v_category='' or v_category='Any' then raise exception 'Choose a specific matchmaking category'; end if;
  if v_difficulty not in ('easy','medium','hard') then raise exception 'Choose easy, medium, or hard difficulty'; end if;
  select count(*) into available from public.questions q where q.is_active and q.category=v_category and q.difficulty=v_difficulty;
  if available<10 then raise exception 'That category/difficulty currently has only % active questions. At least 10 are required for matchmaking.',available; end if;

  select g.* into g_rec from public.games g
  where g.visibility='public' and g.allow_matchmaking and g.status in ('lobby','question','results') and g.category=v_category and g.difficulty=v_difficulty
    and not exists(select 1 from public.game_players me where me.game_id=g.id and me.user_id=auth.uid())
    and (select count(*) from public.game_players gp where gp.game_id=g.id)<g.max_players
  order by case when g.status='lobby' then 0 else 1 end,case when g.lobby_kind='matchmaking' then 0 else 1 end,g.created_at desc
  limit 1 for update skip locked;

  if g_rec.id is not null then
    insert into public.game_players(game_id,user_id,participation_status,joined_cycle)
    values(g_rec.id,auth.uid(),case when g_rec.status='lobby' then 'active' else 'spectator' end,g_rec.cycle_no)
    on conflict(game_id,user_id) do update set participation_status=case when public.game_players.participation_status='active' then 'active' else excluded.participation_status end,is_connected=true;
    update public.games gg set last_activity_at=now(),last_human_seen_at=now() where gg.id=g_rec.id;
    return query select g_rec.code,case when g_rec.status='lobby' then 'player' else 'spectator' end,false;
    return;
  end if;

  loop c:=public.make_code();tries:=tries+1;exit when not exists(select 1 from public.games where games.code=c);if tries>20 then raise exception 'Could not allocate matchmaking code';end if;end loop;
  insert into public.games(code,host_id,title,category,difficulty,question_count,max_players,game_mode,seconds_per_question,visibility,allow_matchmaking,lobby_kind,matchmaking_target,last_activity_at,last_human_seen_at)
  values(c,auth.uid(),v_category||' Quick Match',v_category,v_difficulty,10,10,'standard',20,'public',true,'matchmaking',10,now(),now()) returning * into g_rec;
  insert into public.game_players(game_id,user_id,participation_status,joined_cycle) values(g_rec.id,auth.uid(),'active',g_rec.cycle_no);
  perform public._start_game_v14(g_rec.id);
  return query select c,'player',true;
end $$;
revoke all on function public.matchmake_v18(text,text) from public,anon;
grant execute on function public.matchmake_v18(text,text) to authenticated;

-- Replace Live Ops payload with health metadata while keeping the existing API name.
create or replace function public.admin_live_operations_v15()
returns jsonb language plpgsql security definer set search_path=public as $$
declare out_json jsonb; lifecycle jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  perform public._maybe_room_lifecycle_sweep_v17();
  lifecycle:=public.admin_room_lifecycle_status_v17();
  with online as (
    select p.* from public.trivia_presence p where p.last_seen_at>=now()-interval '90 seconds'
  ), game_rows as (
    select g.* from public.games g where g.status in ('lobby','question','results') or exists(select 1 from online o where o.game_id=g.id)
  ), game_json as (
    select jsonb_build_object(
      'id',g.id,'code',g.code,'title',coalesce(g.title,'Trivia Party'),'status',g.status,'visibility',coalesce(g.visibility,'invite_only'),
      'allow_matchmaking',coalesce(g.allow_matchmaking,false),'lobby_kind',coalesce(g.lobby_kind,'custom'),'cycle_no',coalesce(g.cycle_no,1),
      'category',g.category,'difficulty',g.difficulty,'question_count',g.question_count,'current_question_index',g.current_question_index,
      'seconds_per_question',g.seconds_per_question,'question_started_at',g.question_started_at,'results_started_at',g.results_started_at,'created_at',g.created_at,
      'last_activity_at',g.last_activity_at,'last_human_seen_at',g.last_human_seen_at,'health',public.admin_room_health_v18(g.id),
      'current_question',(select q.prompt from public.game_questions gq join public.questions q on q.id=gq.question_id where gq.game_id=g.id and gq.ordinal=g.current_question_index limit 1),
      'human_count',(select count(*) from public.game_players gp where gp.game_id=g.id),
      'online_human_count',(select count(*) from public.game_players gp join online o on o.user_id=gp.user_id where gp.game_id=g.id and o.game_id=g.id),
      'spectator_count',(select count(*) from public.game_players gp where gp.game_id=g.id and gp.participation_status='spectator'),
      'bot_count',(select count(*) from public.game_bots gb where gb.game_id=g.id),
      'players',coalesce((select jsonb_agg(player order by sort_key,username) from (
        select jsonb_build_object('user_id',gp.user_id,'username',pr.username,'avatar_url',pr.avatar_url,'is_bot',false,'participation_status',gp.participation_status,'total_score',gp.total_score,'online',(o.user_id is not null and o.game_id=g.id),'last_seen_at',o.last_seen_at,'page',o.page,'joined_at',gp.joined_at) player,
          case when gp.participation_status='active' then 0 else 1 end sort_key,pr.username
        from public.game_players gp join public.profiles pr on pr.user_id=gp.user_id left join online o on o.user_id=gp.user_id where gp.game_id=g.id
        union all
        select jsonb_build_object('user_id',gb.bot_id,'username',gb.username,'avatar_url',null,'is_bot',true,'participation_status','active','total_score',gb.total_score,'online',true,'last_seen_at',null,'page','bot','joined_at',gb.joined_at),2,gb.username
        from public.game_bots gb where gb.game_id=g.id
      ) roster),'[]'::jsonb)
    ) obj from game_rows g order by case g.status when 'question' then 0 when 'results' then 1 else 2 end,g.created_at desc
  ), online_json as (
    select jsonb_build_object('user_id',o.user_id,'username',pr.username,'avatar_url',pr.avatar_url,'page',o.page,'last_seen_at',o.last_seen_at,'first_seen_at',o.first_seen_at,'game_id',o.game_id,'game_code',g.code,'game_title',g.title,'game_status',g.status) obj
    from online o join public.profiles pr on pr.user_id=o.user_id left join public.games g on g.id=o.game_id order by o.last_seen_at desc
  )
  select jsonb_build_object('generated_at',now(),'online_count',(select count(*) from online),'live_game_count',(select count(*) from game_rows),'online_users',coalesce((select jsonb_agg(obj) from online_json),'[]'::jsonb),'games',coalesce((select jsonb_agg(obj) from game_json),'[]'::jsonb),'lifecycle',lifecycle) into out_json;
  return out_json;
end $$;
revoke all on function public.admin_live_operations_v15() from public,anon;
grant execute on function public.admin_live_operations_v15() to authenticated;

-- Verification
select jsonb_build_object(
  'missing_rpcs',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select req x from (values ('admin_room_health_v18'),('admin_shutdown_room_v18'),('admin_reset_room_v18'),('admin_export_questions_for_edit_v18'),('admin_import_question_edit_pack_v18'),('get_matchmaking_options_v18'),('matchmake_v18')) r(req) where not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=r.req)) s),
  'schema_status',case when exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='matchmake_v18') then 'READY' else 'CHECK' end
) as v18_status;
