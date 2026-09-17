-- WhatMod Trivia V22
-- Free-plan storage hygiene + compact audit history + conservative retention.
-- Safe on top of V21/V20. Does not touch Supabase-managed auth/realtime/storage tables.

begin;

insert into public.trivia_maintenance_state(maintenance_key,last_run_at,last_result,updated_at)
values('storage_hygiene',null,'{}'::jsonb,now())
on conflict(maintenance_key) do nothing;

-- -----------------------------------------------------------------------------
-- Compact question audit rows. Historically the audit log stored entire question
-- snapshots for even tiny edits. V22 keeps only changed, editorially useful keys.
-- The admin audit UI still has before/after values for every changed field.
-- -----------------------------------------------------------------------------
create or replace function public._question_audit_delta_v22(
  p_before jsonb,
  p_after jsonb,
  p_after_side boolean
)
returns jsonb
language sql
immutable
set search_path=public
as $$
  with allowed(k) as (
    select unnest(array[
      'prompt','category','difficulty','question_type','context','unit',
      'answer_numeric','answer_text','options','correct_option','explanation',
      'source_url','source_type','source_entity_id','canonical_key','media_query',
      'is_active','deleted_at','delete_reason','photo_disabled','photo_disabled_at',
      'content_locked','image_url','image_alt','image_source_url','image_attribution',
      'image_license','image_license_url','media_provider','media_review_status',
      'media_locked','media_candidate_id'
    ]::text[])
  ), changed as (
    select a.k,
      case when p_after_side
        then coalesce(p_after,'{}'::jsonb)->a.k
        else coalesce(p_before,'{}'::jsonb)->a.k
      end as v
    from allowed a
    where (coalesce(p_before,'{}'::jsonb)->a.k)
            is distinct from
          (coalesce(p_after,'{}'::jsonb)->a.k)
      and (
        (p_after_side and coalesce(p_after,'{}'::jsonb) ? a.k)
        or
        (not p_after_side and coalesce(p_before,'{}'::jsonb) ? a.k)
      )
  )
  select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) from changed;
$$;

revoke all on function public._question_audit_delta_v22(jsonb,jsonb,boolean) from public,anon,authenticated;

create or replace function public._compact_question_audit_insert_v22()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.before_data := public._question_audit_delta_v22(new.before_data,new.after_data,false);
  new.after_data  := public._question_audit_delta_v22(new.before_data,new.after_data,true);
  new.metadata := coalesce(new.metadata,'{}'::jsonb)
    || jsonb_build_object('storage_compacted',true,'storage_format',22);
  return new;
end $$;

-- The trigger must calculate both sides from the original incoming row. The
-- wrapper below preserves the original JSON values before assigning them.
create or replace function public._compact_question_audit_insert_v22()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_before jsonb := new.before_data;
  v_after jsonb := new.after_data;
begin
  new.before_data := public._question_audit_delta_v22(v_before,v_after,false);
  new.after_data  := public._question_audit_delta_v22(v_before,v_after,true);
  new.metadata := coalesce(new.metadata,'{}'::jsonb)
    || jsonb_build_object('storage_compacted',true,'storage_format',22);
  return new;
end $$;

revoke all on function public._compact_question_audit_insert_v22() from public,anon,authenticated;

drop trigger if exists compact_question_audit_insert_v22 on public.question_audit_log;
create trigger compact_question_audit_insert_v22
before insert on public.question_audit_log
for each row execute function public._compact_question_audit_insert_v22();

-- Compact the existing audit history in place once.
update public.question_audit_log a
set before_data=public._question_audit_delta_v22(a.before_data,a.after_data,false),
    after_data=public._question_audit_delta_v22(a.before_data,a.after_data,true),
    metadata=coalesce(a.metadata,'{}'::jsonb)
      || jsonb_build_object('storage_compacted',true,'storage_format',22)
where coalesce((a.metadata->>'storage_format')::int,0) < 22;

-- Keep the audit browser useful after diff compaction. If prompt did not change,
-- use the current question prompt instead of showing "Deleted question".
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
    select a.id,a.question_id,a.action,a.actor_user_id,a.actor_username,a.actor_email,
      a.before_data,a.after_data,a.metadata,a.created_at,
      coalesce(a.after_data->>'prompt',a.before_data->>'prompt',q.prompt,'Deleted question') as prompt,
      count(*) over() total_count
    from public.question_audit_log a
    left join public.questions q on q.id=a.question_id
    where (p_action is null or p_action='' or p_action='all' or a.action=p_action)
      and (
        p_search is null or trim(p_search)=''
        or coalesce(a.after_data->>'prompt',a.before_data->>'prompt',q.prompt,'') ilike '%'||trim(p_search)||'%'
        or coalesce(a.actor_username,'') ilike '%'||trim(p_search)||'%'
        or coalesce(a.actor_email,'') ilike '%'||trim(p_search)||'%'
      )
    order by a.created_at desc
    limit greatest(1,least(250,coalesce(p_limit,100)))
    offset greatest(0,coalesce(p_offset,0))
  )
  select jsonb_build_object(
    'total',coalesce(max(r.total_count),0),
    'items',coalesce(jsonb_agg(to_jsonb(r)-'total_count'),'[]'::jsonb)
  ) into out_json from rows r;
  return out_json;
end $$;

revoke all on function public.admin_list_question_audit_v10(text,text,int,int) from public,anon;
grant execute on function public.admin_list_question_audit_v10(text,text,int,int) to authenticated;

-- -----------------------------------------------------------------------------
-- Media candidate retention.
-- Keep the selected/approved media plus the best few usable alternatives. Rejected
-- rows are retained only as tiny fingerprints so the same rejected image can stay
-- rejected without carrying full metadata forever.
-- -----------------------------------------------------------------------------
create or replace function public._prune_media_candidates_v22(p_keep_alternatives int default 4)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_keep int := greatest(2,least(8,coalesce(p_keep_alternatives,4)));
  v_rejected_compacted int := 0;
  v_metadata_compacted int := 0;
  v_unavailable_deleted int := 0;
  v_extra_deleted int := 0;
begin
  update public.question_media_candidates c
  set title=null,
      image_url='about:blank',
      thumbnail_url=null,
      source_url=null,
      creator=null,
      creator_url=null,
      license=null,
      license_url=null,
      width=null,
      height=null,
      score=0,
      auto_eligible=false,
      is_available=false,
      metadata='{}'::jsonb
  where c.status='rejected'
    and (
      c.image_url<>'about:blank' or c.title is not null or c.thumbnail_url is not null
      or c.source_url is not null or c.creator is not null or c.license is not null
      or c.metadata<>'{}'::jsonb
    );
  get diagnostics v_rejected_compacted = row_count;

  update public.question_media_candidates c
  set metadata='{}'::jsonb
  where c.status<>'rejected' and c.metadata<>'{}'::jsonb;
  get diagnostics v_metadata_compacted = row_count;

  delete from public.question_media_candidates c
  using public.questions q
  where c.question_id=q.id
    and c.status='candidate'
    and c.is_available=false
    and c.id is distinct from q.media_candidate_id;
  get diagnostics v_unavailable_deleted = row_count;

  with ranked as (
    select c.id,
      row_number() over(
        partition by c.question_id
        order by c.auto_eligible desc,c.score desc,c.updated_at desc,c.id
      ) as rn
    from public.question_media_candidates c
    join public.questions q on q.id=c.question_id
    where c.status='candidate'
      and c.is_available=true
      and c.id is distinct from q.media_candidate_id
  )
  delete from public.question_media_candidates c
  using ranked r
  where c.id=r.id and r.rn>v_keep;
  get diagnostics v_extra_deleted = row_count;

  return jsonb_build_object(
    'keep_alternatives',v_keep,
    'rejected_rows_compacted',v_rejected_compacted,
    'metadata_rows_compacted',v_metadata_compacted,
    'unavailable_rows_deleted',v_unavailable_deleted,
    'extra_rows_deleted',v_extra_deleted,
    'remaining_rows',(select count(*) from public.question_media_candidates)
  );
end $$;

revoke all on function public._prune_media_candidates_v22(int) from public,anon,authenticated;

-- The provider-only index is redundant with the unique key + per-question index
-- for current app access patterns, and costs storage/write amplification.
drop index if exists public.question_media_candidates_provider_idx;

-- -----------------------------------------------------------------------------
-- Conservative runtime retention. Permanent question/profile/library/aggregate
-- data is never removed here.
-- -----------------------------------------------------------------------------
create or replace function public._perform_storage_hygiene_v22()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_now timestamptz := now();
  v_media jsonb;
  v_presence int := 0;
  v_bot_answers int := 0;
  v_bots int := 0;
  v_game_answers int := 0;
  v_game_questions int := 0;
  v_game_players int := 0;
  v_games int := 0;
  v_abandoned_games int := 0;
  v_practice_sessions int := 0;
  v_daily_attempts int := 0;
  v_result jsonb;
begin
  v_media := public._prune_media_candidates_v22(4);

  delete from public.trivia_presence p
  where p.last_seen_at < v_now - interval '12 hours';
  get diagnostics v_presence = row_count;

  delete from public.game_bot_answers ba
  using public.games g
  where ba.game_id=g.id
    and g.status in ('finished','cancelled')
    and coalesce(g.closed_at,g.finished_at,g.last_activity_at,g.created_at) < v_now - interval '14 days';
  get diagnostics v_bot_answers = row_count;

  delete from public.game_bots b
  using public.games g
  where b.game_id=g.id
    and g.status in ('finished','cancelled')
    and coalesce(g.closed_at,g.finished_at,g.last_activity_at,g.created_at) < v_now - interval '14 days';
  get diagnostics v_bots = row_count;

  -- Once the replay library has the ordered question IDs, the raw answer/question
  -- rows are disposable. Aggregate answer histograms were already updated on insert.
  delete from public.game_answers a
  using public.games g
  where a.game_id=g.id
    and g.library_session_id is not null
    and g.status in ('finished','cancelled')
    and coalesce(g.closed_at,g.finished_at,g.last_activity_at,g.created_at) < v_now - interval '30 days';
  get diagnostics v_game_answers = row_count;

  delete from public.game_questions q
  using public.games g
  where q.game_id=g.id
    and g.library_session_id is not null
    and g.status in ('finished','cancelled')
    and coalesce(g.closed_at,g.finished_at,g.last_activity_at,g.created_at) < v_now - interval '30 days';
  get diagnostics v_game_questions = row_count;

  delete from public.game_players gp
  using public.games g
  where gp.game_id=g.id
    and g.library_session_id is not null
    and g.status in ('finished','cancelled')
    and coalesce(g.closed_at,g.finished_at,g.last_activity_at,g.created_at) < v_now - interval '90 days';
  get diagnostics v_game_players = row_count;

  -- Cancelled rooms that never produced a replay are purely operational state.
  delete from public.games g
  where g.library_session_id is null
    and g.status='cancelled'
    and coalesce(g.closed_at,g.last_activity_at,g.created_at) < v_now - interval '30 days';
  get diagnostics v_abandoned_games = row_count;

  -- The Replay Library is the permanent representation. Keep the original game
  -- shell for six months for operational history, then let the compact replay win.
  delete from public.games g
  where g.library_session_id is not null
    and g.status in ('finished','cancelled')
    and coalesce(g.closed_at,g.finished_at,g.last_activity_at,g.created_at) < v_now - interval '180 days';
  get diagnostics v_games = row_count;

  delete from public.practice_sessions ps
  where ps.status='completed'
    and ps.library_session_id is not null
    and ps.completed_at < v_now - interval '30 days';
  get diagnostics v_practice_sessions = row_count;

  -- Profiles already retain XP/streak state. Old Daily rows are not needed to
  -- enforce today's one-play lock or to render today's community distribution.
  delete from public.daily_attempts d
  where d.day < current_date - 120;
  get diagnostics v_daily_attempts = row_count;

  v_result := jsonb_build_object(
    'ran_at',v_now,
    'media',v_media,
    'presence_rows_pruned',v_presence,
    'bot_answer_rows_pruned',v_bot_answers,
    'bot_rows_pruned',v_bots,
    'game_answer_rows_pruned',v_game_answers,
    'game_question_rows_pruned',v_game_questions,
    'game_player_rows_pruned',v_game_players,
    'abandoned_game_shells_pruned',v_abandoned_games,
    'old_game_shells_pruned',v_games,
    'practice_sessions_pruned',v_practice_sessions,
    'daily_attempts_pruned',v_daily_attempts
  );

  update public.trivia_maintenance_state
  set last_run_at=v_now,last_result=v_result,updated_at=v_now
  where maintenance_key='storage_hygiene';

  return v_result;
end $$;

revoke all on function public._perform_storage_hygiene_v22() from public,anon,authenticated;

create or replace function public._maybe_storage_hygiene_v22()
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_last timestamptz;
begin
  select m.last_run_at into v_last
  from public.trivia_maintenance_state m
  where m.maintenance_key='storage_hygiene';

  if v_last is not null and v_last >= now()-interval '12 hours' then return; end if;
  if not pg_try_advisory_xact_lock(hashtext('whatmod_trivia_storage_hygiene_v22')) then return; end if;

  select m.last_run_at into v_last
  from public.trivia_maintenance_state m
  where m.maintenance_key='storage_hygiene';
  if v_last is null or v_last < now()-interval '12 hours' then
    perform public._perform_storage_hygiene_v22();
  end if;
end $$;

revoke all on function public._maybe_storage_hygiene_v22() from public,anon,authenticated;

-- Preserve V17 room lifecycle behavior and add the twice-daily storage check.
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
  perform public._maybe_storage_hygiene_v22();
end $$;

revoke all on function public.touch_trivia_presence_v15(text,uuid,text) from public,anon;
grant execute on function public.touch_trivia_presence_v15(text,uuid,text) to authenticated;

-- -----------------------------------------------------------------------------
-- Admin observability + manual maintenance.
-- -----------------------------------------------------------------------------
create or replace function public.admin_storage_hygiene_status_v22()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_state public.trivia_maintenance_state%rowtype;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select * into v_state from public.trivia_maintenance_state where maintenance_key='storage_hygiene';
  return jsonb_build_object(
    'last_run_at',v_state.last_run_at,
    'last_result',coalesce(v_state.last_result,'{}'::jsonb),
    'media_candidates',jsonb_build_object(
      'rows',(select count(*) from public.question_media_candidates),
      'bytes',pg_total_relation_size('public.question_media_candidates'::regclass)
    ),
    'audit_log',jsonb_build_object(
      'rows',(select count(*) from public.question_audit_log),
      'bytes',pg_total_relation_size('public.question_audit_log'::regclass)
    ),
    'questions',jsonb_build_object(
      'rows',(select count(*) from public.questions),
      'bytes',pg_total_relation_size('public.questions'::regclass)
    ),
    'retention',jsonb_build_object(
      'presence_hours',12,
      'bot_runtime_days',14,
      'completed_runtime_days',30,
      'abandoned_game_days',30,
      'game_player_days',90,
      'game_shell_days',180,
      'practice_days',30,
      'daily_attempt_days',120,
      'media_alternatives_per_question',4
    )
  );
end $$;

revoke all on function public.admin_storage_hygiene_status_v22() from public,anon;
grant execute on function public.admin_storage_hygiene_status_v22() to authenticated;

create or replace function public.admin_run_storage_hygiene_v22()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_result jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  perform pg_advisory_xact_lock(hashtext('whatmod_trivia_storage_hygiene_v22'));
  v_result := public._perform_storage_hygiene_v22();
  return v_result;
end $$;

revoke all on function public.admin_run_storage_hygiene_v22() from public,anon;
grant execute on function public.admin_run_storage_hygiene_v22() to authenticated;

-- Efficient category aggregates for the locally connected Content Studio.
create or replace function public.content_studio_category_population_v22()
returns jsonb
language sql
security definer
set search_path=public
as $$
  with agg as (
    select q.category,
      count(*)::bigint total_count,
      count(*) filter(where q.is_active)::bigint active_count,
      count(*) filter(where q.is_active and q.difficulty='easy')::bigint easy_count,
      count(*) filter(where q.is_active and q.difficulty='medium')::bigint medium_count,
      count(*) filter(where q.is_active and q.difficulty='hard')::bigint hard_count,
      count(*) filter(where q.is_active and nullif(trim(q.image_url),'') is not null
        and coalesce(q.media_review_status,'unreviewed') not in ('rejected','none')
        and not coalesce(q.photo_disabled,false))::bigint valid_photo_count,
      count(*) filter(where q.is_active and not(
        nullif(trim(q.image_url),'') is not null
        and coalesce(q.media_review_status,'unreviewed') not in ('rejected','none')
        and not coalesce(q.photo_disabled,false)
      ))::bigint missing_photo_count,
      count(*) filter(where not q.is_active)::bigint retired_count
    from public.questions q group by q.category
  ), rows as (
    select c.category,c.sort_order,c.default_terms,
      coalesce(a.total_count,0) total_count,
      coalesce(a.active_count,0) active_count,
      coalesce(a.easy_count,0) easy_count,
      coalesce(a.medium_count,0) medium_count,
      coalesce(a.hard_count,0) hard_count,
      coalesce(a.valid_photo_count,0) valid_photo_count,
      coalesce(a.missing_photo_count,0) missing_photo_count,
      coalesce(a.retired_count,0) retired_count
    from public.trivia_category_catalog c
    left join agg a on a.category=c.category
    where c.enabled=true
    union all
    select a.category,1000,array[a.category]::text[],a.total_count,a.active_count,a.easy_count,a.medium_count,a.hard_count,
      a.valid_photo_count,a.missing_photo_count,a.retired_count
    from agg a
    where not exists(select 1 from public.trivia_category_catalog c where c.category=a.category and c.enabled=true)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'category',r.category,'sort_order',r.sort_order,'terms',r.default_terms,
    'total_count',r.total_count,'active_count',r.active_count,
    'easy_count',r.easy_count,'medium_count',r.medium_count,'hard_count',r.hard_count,
    'valid_photo_count',r.valid_photo_count,'missing_photo_count',r.missing_photo_count,'retired_count',r.retired_count
  ) order by r.sort_order,r.category),'[]'::jsonb)
  from rows r;
$$;

revoke all on function public.content_studio_category_population_v22() from public,anon,authenticated;
grant execute on function public.content_studio_category_population_v22() to service_role;

-- Run one cleanup immediately so this upgrade fixes the current footprint instead
-- of waiting for the first heartbeat.
select public._perform_storage_hygiene_v22();

commit;

-- Verification only. VACUUM FULL is intentionally provided as a separate file
-- because it takes short exclusive locks while physically returning freed pages.
select jsonb_build_object(
  'storage_hygiene_rpc',exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_run_storage_hygiene_v22'),
  'audit_compaction_trigger',exists(select 1 from pg_trigger t where t.tgname='compact_question_audit_insert_v22' and not t.tgisinternal),
  'status','READY'
) as v22_status;
