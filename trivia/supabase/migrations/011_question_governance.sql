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
