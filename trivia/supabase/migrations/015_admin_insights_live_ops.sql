-- WhatMod Trivia V15 - Admin vote review, reversible media gating, live operations
-- Safe on top of the V14.2 reconciled schema. No existing trivia data is reset.

begin;

-- -----------------------------------------------------------------------------
-- Reversible photo moderation state.
-- photo_disabled is distinct from a normal admin delete/retire so bulk actions
-- can be undone without resurrecting questions that were deliberately deleted.
-- -----------------------------------------------------------------------------
alter table public.questions
  add column if not exists photo_disabled boolean not null default false,
  add column if not exists photo_disabled_at timestamptz,
  add column if not exists photo_disabled_by uuid references auth.users(id) on delete set null,
  add column if not exists photo_disable_batch_id uuid;

create index if not exists questions_photo_disabled_idx
  on public.questions(photo_disabled,is_active,updated_at desc);

create table if not exists public.question_moderation_batches (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('photo_disable','photo_restore')),
  actor_user_id uuid references auth.users(id) on delete set null,
  affected_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.question_moderation_batches enable row level security;
revoke all on public.question_moderation_batches from public,anon,authenticated;

-- Extend the existing append-only question audit log with reversible media
-- moderation actions.
alter table public.question_audit_log
  drop constraint if exists question_audit_log_action_check;
alter table public.question_audit_log
  add constraint question_audit_log_action_check
  check (action in ('create','edit','delete','restore','media_disable','media_restore')) not valid;

-- -----------------------------------------------------------------------------
-- Logged-in presence. This is deliberately heartbeat-based instead of relying
-- on stale game_players.is_connected values. Admin treats <=90 seconds as live.
-- -----------------------------------------------------------------------------
create table if not exists public.trivia_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  page text,
  game_id uuid references public.games(id) on delete set null,
  client_id text
);

create index if not exists trivia_presence_seen_idx
  on public.trivia_presence(last_seen_at desc);
create index if not exists trivia_presence_game_idx
  on public.trivia_presence(game_id,last_seen_at desc);

alter table public.trivia_presence enable row level security;
revoke all on public.trivia_presence from public,anon,authenticated;

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
  insert into public.trivia_presence(user_id,first_seen_at,last_seen_at,page,game_id,client_id)
  values(auth.uid(),now(),now(),left(nullif(trim(p_page),''),80),p_game_id,left(nullif(trim(p_client_id),''),120))
  on conflict(user_id) do update set
    last_seen_at=now(),
    page=excluded.page,
    game_id=excluded.game_id,
    client_id=coalesce(excluded.client_id,public.trivia_presence.client_id);
end $$;

revoke all on function public.touch_trivia_presence_v15(text,uuid,text) from public,anon;
grant execute on function public.touch_trivia_presence_v15(text,uuid,text) to authenticated;

create or replace function public.clear_trivia_presence_v15()
returns void
language sql
security definer
set search_path=public
as $$
  delete from public.trivia_presence p where p.user_id=auth.uid();
$$;

revoke all on function public.clear_trivia_presence_v15() from public,anon;
grant execute on function public.clear_trivia_presence_v15() to authenticated;

-- -----------------------------------------------------------------------------
-- Stored media health. "Valid" here means the question has a selected URL and
-- its resolver/admin metadata does not mark that selection unavailable/rejected.
-- External URLs are not fetched from Postgres; the local resolver is still the
-- authoritative network verifier.
-- -----------------------------------------------------------------------------
create or replace function public.question_has_valid_photo_v15(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select
      nullif(trim(q.image_url),'') is not null
      and coalesce(q.media_review_status,'unreviewed') not in ('rejected','none')
      and (
        q.media_candidate_id is null
        or exists(
          select 1 from public.question_media_candidates c
          where c.id=q.media_candidate_id
            and c.question_id=q.id
            and c.is_available=true
            and c.status<>'rejected'
        )
      )
    from public.questions q where q.id=p_question_id
  ),false);
$$;

revoke all on function public.question_has_valid_photo_v15(uuid) from public,anon,authenticated;

create or replace function public.admin_photo_health_v15()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare out_json jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select jsonb_build_object(
    'active_with_valid_photo',count(*) filter(where q.is_active and public.question_has_valid_photo_v15(q.id)),
    'active_without_valid_photo',count(*) filter(where q.is_active and not public.question_has_valid_photo_v15(q.id)),
    'photo_disabled',count(*) filter(where q.photo_disabled),
    'total_questions',count(*)
  ) into out_json
  from public.questions q;
  return out_json;
end $$;

revoke all on function public.admin_photo_health_v15() from public,anon;
grant execute on function public.admin_photo_health_v15() to authenticated;

create or replace function public.admin_disable_questions_without_valid_photos_v15()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  actor_name text; actor_mail text; batch_id uuid:=gen_random_uuid(); affected int:=0;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select p.username into actor_name from public.profiles p where p.user_id=auth.uid();
  select u.email into actor_mail from auth.users u where u.id=auth.uid();

  insert into public.question_moderation_batches(id,action,actor_user_id,metadata)
  values(batch_id,'photo_disable',auth.uid(),jsonb_build_object('rule','stored media must have a usable selected image'));

  with candidates as (
    select q.* from public.questions q
    where q.is_active=true
      and q.photo_disabled=false
      and not public.question_has_valid_photo_v15(q.id)
  ), audit_rows as (
    insert into public.question_audit_log(
      question_id,action,actor_user_id,actor_username,actor_email,before_data,after_data,metadata,created_at
    )
    select c.id,'media_disable',auth.uid(),actor_name,actor_mail,to_jsonb(c),
      to_jsonb(c) || jsonb_build_object(
        'is_active',false,'photo_disabled',true,'photo_disabled_at',now(),'photo_disable_batch_id',batch_id
      ),
      jsonb_build_object('origin','triviaadmin','batch_id',batch_id,'reason','No valid stored photo'),now()
    from candidates c
    returning 1
  )
  update public.questions q set
    is_active=false,
    photo_disabled=true,
    photo_disabled_at=now(),
    photo_disabled_by=auth.uid(),
    photo_disable_batch_id=batch_id,
    updated_at=now()
  where q.id in (
    select qq.id from public.questions qq
    where qq.is_active=true
      and qq.photo_disabled=false
      and not public.question_has_valid_photo_v15(qq.id)
  );

  get diagnostics affected = row_count;
  update public.question_moderation_batches b set affected_count=affected where b.id=batch_id;
  return jsonb_build_object('batch_id',batch_id,'disabled',affected);
end $$;

revoke all on function public.admin_disable_questions_without_valid_photos_v15() from public,anon;
grant execute on function public.admin_disable_questions_without_valid_photos_v15() to authenticated;

create or replace function public.admin_restore_photo_disabled_questions_v15()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  actor_name text; actor_mail text; batch_id uuid:=gen_random_uuid(); affected int:=0;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select p.username into actor_name from public.profiles p where p.user_id=auth.uid();
  select u.email into actor_mail from auth.users u where u.id=auth.uid();

  insert into public.question_moderation_batches(id,action,actor_user_id,metadata)
  values(batch_id,'photo_restore',auth.uid(),jsonb_build_object('scope','all currently photo-disabled questions'));

  insert into public.question_audit_log(
    question_id,action,actor_user_id,actor_username,actor_email,before_data,after_data,metadata,created_at
  )
  select q.id,'media_restore',auth.uid(),actor_name,actor_mail,to_jsonb(q),
    to_jsonb(q) || jsonb_build_object(
      'is_active',true,'photo_disabled',false,'photo_disabled_at',null,'photo_disabled_by',null,'photo_disable_batch_id',null
    ),
    jsonb_build_object('origin','triviaadmin','batch_id',batch_id,'reason','Undo photo gating'),now()
  from public.questions q
  where q.photo_disabled=true and q.deleted_at is null;

  update public.questions q set
    is_active=true,
    photo_disabled=false,
    photo_disabled_at=null,
    photo_disabled_by=null,
    photo_disable_batch_id=null,
    updated_at=now()
  where q.photo_disabled=true and q.deleted_at is null;

  get diagnostics affected = row_count;
  update public.question_moderation_batches b set affected_count=affected where b.id=batch_id;
  return jsonb_build_object('batch_id',batch_id,'restored',affected);
end $$;

revoke all on function public.admin_restore_photo_disabled_questions_v15() from public,anon;
grant execute on function public.admin_restore_photo_disabled_questions_v15() to authenticated;

create or replace function public.admin_question_overview_v15()
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
    'retired',count(*) filter(where not q.is_active and not q.photo_disabled),
    'photo_disabled',count(*) filter(where q.photo_disabled),
    'manual',count(*) filter(where coalesce(q.source_type,'manual')='manual'),
    'hydrated',count(*) filter(where q.canonical_key is not null),
    'with_votes',(select count(distinct v.question_id) from public.question_votes v),
    'total_upvotes',(select count(*) from public.question_votes v where v.vote=1),
    'total_downvotes',(select count(*) from public.question_votes v where v.vote=-1)
  ) into out_json
  from public.questions q;
  return out_json;
end $$;

revoke all on function public.admin_question_overview_v15() from public,anon;
grant execute on function public.admin_question_overview_v15() to authenticated;

-- Question Explorer with the additional reversible photo-disabled state.
create or replace function public.admin_list_questions_v15(
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
      q.image_url,q.media_review_status,q.media_locked,q.photo_disabled,q.photo_disabled_at,
      public.question_has_valid_photo_v15(q.id) as has_valid_photo,
      q.created_at,q.updated_at,q.deleted_at,q.delete_reason,
      coalesce(v.upvotes,0) as upvotes,coalesce(v.downvotes,0) as downvotes,
      count(*) over() as total_count
    from public.questions q
    left join vote_totals v on v.question_id=q.id
    where
      (p_search is null or trim(p_search)='' or q.prompt ilike '%'||trim(p_search)||'%' or coalesce(q.media_query,'') ilike '%'||trim(p_search)||'%' or coalesce(q.canonical_key,'') ilike '%'||trim(p_search)||'%')
      and (p_category is null or p_category='' or q.category=p_category)
      and (p_difficulty is null or p_difficulty='' or p_difficulty='any' or q.difficulty=p_difficulty)
      and (
        p_status='all'
        or (p_status='active' and q.is_active)
        or (p_status='retired' and not q.is_active and not q.photo_disabled)
        or (p_status='photo_disabled' and q.photo_disabled)
        or (p_status='missing_photo' and q.is_active and not public.question_has_valid_photo_v15(q.id))
      )
      and (p_source is null or p_source='' or coalesce(q.source_type,'manual')=p_source)
    order by q.is_active desc,q.photo_disabled desc,q.updated_at desc,q.created_at desc
    limit greatest(1,least(200,coalesce(p_limit,50)))
    offset greatest(0,coalesce(p_offset,0))
  )
  select jsonb_build_object(
    'total',coalesce(max(f.total_count),0),
    'items',coalesce(jsonb_agg(to_jsonb(f)-'total_count'),'[]'::jsonb)
  ) into out_json from filtered f;
  return out_json;
end $$;

revoke all on function public.admin_list_questions_v15(text,text,text,text,text,int,int) from public,anon;
grant execute on function public.admin_list_questions_v15(text,text,text,text,text,int,int) to authenticated;

-- Vote-focused question list. The p_vote direction controls which community
-- signal the admin is reviewing while still showing both totals on every row.
create or replace function public.admin_list_voted_questions_v15(
  p_vote int default 1,
  p_search text default null,
  p_status text default 'all',
  p_limit int default 75,
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
  if p_vote not in (-1,1) then raise exception 'Vote direction must be 1 or -1'; end if;
  with totals as (
    select v.question_id,
      count(*) filter(where v.vote=1)::bigint upvotes,
      count(*) filter(where v.vote=-1)::bigint downvotes
    from public.question_votes v group by v.question_id
  ), rows as (
    select q.id,q.prompt,q.category,q.difficulty,q.question_type,q.is_active,q.photo_disabled,
      q.image_url,q.media_review_status,q.updated_at,q.created_at,
      t.upvotes,t.downvotes,(t.upvotes-t.downvotes) as score,
      case when (t.upvotes+t.downvotes)>0 then round((t.upvotes::numeric/(t.upvotes+t.downvotes))*100,1) else 0 end as approval_pct,
      count(*) over() total_count
    from totals t join public.questions q on q.id=t.question_id
    where (case when p_vote=1 then t.upvotes else t.downvotes end)>0
      and (p_search is null or trim(p_search)='' or q.prompt ilike '%'||trim(p_search)||'%')
      and (p_status='all' or (p_status='active' and q.is_active) or (p_status='retired' and not q.is_active))
    order by
      case when p_vote=1 then t.upvotes else t.downvotes end desc,
      (t.upvotes+t.downvotes) desc,q.updated_at desc
    limit greatest(1,least(250,coalesce(p_limit,75))) offset greatest(0,coalesce(p_offset,0))
  )
  select jsonb_build_object(
    'total',coalesce(max(r.total_count),0),
    'items',coalesce(jsonb_agg(to_jsonb(r)-'total_count'),'[]'::jsonb)
  ) into out_json from rows r;
  return out_json;
end $$;

revoke all on function public.admin_list_voted_questions_v15(int,text,text,int,int) from public,anon;
grant execute on function public.admin_list_voted_questions_v15(int,text,text,int,int) to authenticated;

-- V15 wrappers preserve the existing live-game deletion logic while handling a
-- question that is already inactive only because of the reversible photo gate.
create or replace function public.admin_delete_question_v15(
  p_question_id uuid,
  p_reason text default null,
  p_practice_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare q public.questions; before_q jsonb; after_q jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select qq.* into q from public.questions qq where qq.id=p_question_id for update;
  if q.id is null then raise exception 'Question not found'; end if;

  if q.photo_disabled then
    before_q:=to_jsonb(q);
    update public.library_sessions ls set is_public=false,updated_at=now()
      where p_question_id=any(ls.question_ids) and ls.is_public;
    update public.questions qq set
      is_active=false,photo_disabled=false,photo_disabled_at=null,photo_disabled_by=null,photo_disable_batch_id=null,
      deleted_at=now(),deleted_by=auth.uid(),delete_reason=nullif(trim(p_reason),''),updated_at=now()
    where qq.id=p_question_id
    returning qq.* into q;
    after_q:=to_jsonb(q);
    perform public._audit_question_admin(p_question_id,'delete',before_q,after_q,
      jsonb_build_object('reason',nullif(trim(p_reason),''),'origin','triviaadmin','was_photo_disabled',true));
    return jsonb_build_object('question_id',p_question_id,'deleted',true,'games_touched',0,'practices_touched',0);
  end if;

  return public.admin_delete_question_v10(p_question_id,p_reason,p_practice_session_id);
end $$;

revoke all on function public.admin_delete_question_v15(uuid,text,uuid) from public,anon;
grant execute on function public.admin_delete_question_v15(uuid,text,uuid) to authenticated;

create or replace function public.admin_restore_question_v15(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare q public.questions; before_q jsonb; after_q jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select qq.* into q from public.questions qq where qq.id=p_question_id for update;
  if q.id is null then raise exception 'Question not found'; end if;
  if q.photo_disabled then
    before_q:=to_jsonb(q);
    update public.questions qq set
      is_active=true,photo_disabled=false,photo_disabled_at=null,photo_disabled_by=null,photo_disable_batch_id=null,updated_at=now()
    where qq.id=p_question_id returning qq.* into q;
    after_q:=to_jsonb(q);
    perform public._audit_question_admin(p_question_id,'media_restore',before_q,after_q,
      jsonb_build_object('origin','triviaadmin','reason','Single-question photo gate restore'));
    return public.admin_get_question_v10(p_question_id);
  end if;
  return public.admin_restore_question_v10(p_question_id);
end $$;

revoke all on function public.admin_restore_question_v15(uuid) from public,anon;
grant execute on function public.admin_restore_question_v15(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Live operations snapshot: current signed-in presence + all active rooms with
-- human players, spectators, and filler bots.
-- -----------------------------------------------------------------------------
create or replace function public.admin_live_operations_v15()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare out_json jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;

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
    'games',coalesce((select jsonb_agg(obj) from game_json),'[]'::jsonb)
  ) into out_json;

  return out_json;
end $$;

revoke all on function public.admin_live_operations_v15() from public,anon;
grant execute on function public.admin_live_operations_v15() to authenticated;

commit;

-- Post-migration verification row. Expected: schema_status = READY.
with required_columns(table_name,column_name) as (
  values
    ('questions','photo_disabled'),('questions','photo_disabled_at'),('questions','photo_disabled_by'),('questions','photo_disable_batch_id'),
    ('trivia_presence','user_id'),('trivia_presence','last_seen_at'),('trivia_presence','page'),('trivia_presence','game_id')
), missing_columns as (
  select rc.table_name||'.'||rc.column_name as name
  from required_columns rc
  where not exists(
    select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name=rc.table_name and c.column_name=rc.column_name
  )
), required_rpcs(name) as (
  values
    ('admin_question_overview_v15'),('admin_list_questions_v15'),('admin_list_voted_questions_v15'),
    ('admin_photo_health_v15'),('admin_disable_questions_without_valid_photos_v15'),('admin_restore_photo_disabled_questions_v15'),
    ('admin_live_operations_v15'),('touch_trivia_presence_v15'),('clear_trivia_presence_v15'),
    ('admin_delete_question_v15'),('admin_restore_question_v15')
), missing_rpcs as (
  select r.name from required_rpcs r
  where not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=r.name)
)
select jsonb_build_object(
  'missing_columns',coalesce((select jsonb_agg(name) from missing_columns),'[]'::jsonb),
  'missing_rpcs',coalesce((select jsonb_agg(name) from missing_rpcs),'[]'::jsonb),
  'schema_status',case when not exists(select 1 from missing_columns) and not exists(select 1 from missing_rpcs) then 'READY' else 'CHECK_REQUIRED' end
) as v15_schema_check;
