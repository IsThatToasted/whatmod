-- WhatMod Trivia V6 - Community graphs, replay library, question media, and efficient snapshots
-- Safe upgrade for an existing V5 project. No existing profile/game/question data is reset.

-- -----------------------------------------------------------------------------
-- Question media + external-source metadata. Images remain external URLs so the
-- database stores only a few strings, not image bytes.
-- -----------------------------------------------------------------------------
alter table public.questions add column if not exists image_url text;
alter table public.questions add column if not exists image_alt text;
alter table public.questions add column if not exists image_source_url text;
alter table public.questions add column if not exists image_attribution text;
alter table public.questions add column if not exists image_license text;
alter table public.questions add column if not exists image_license_url text;
alter table public.questions add column if not exists source_type text;
alter table public.questions add column if not exists source_entity_id text;
alter table public.questions add column if not exists canonical_key text;

create unique index if not exists questions_canonical_key_unique
  on public.questions(canonical_key);
create index if not exists questions_source_entity_idx
  on public.questions(source_type,source_entity_id)
  where source_entity_id is not null;

-- -----------------------------------------------------------------------------
-- Community answer clustering.
-- Exactly ONE compact row is kept per answered numeric question. We never need
-- one analytics row per user. The 41 bigint bins represent log10(guess/answer)
-- from -4x decades to +4 decades in 0.2-decade steps. Values beyond that are
-- folded into the end buckets. This stays ~constant-size as participation grows.
-- -----------------------------------------------------------------------------
create table if not exists public.question_answer_stats (
  question_id uuid primary key references public.questions(id) on delete cascade,
  total_answers bigint not null default 0 check(total_answers >= 0),
  histogram bigint[] not null default array_fill(0::bigint,array[41]),
  first_answered_at timestamptz,
  last_answered_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint question_answer_stats_histogram_len check(array_length(histogram,1)=41)
);

alter table public.question_answer_stats enable row level security;
revoke all on public.question_answer_stats from anon,authenticated;

create or replace function public.bump_histogram(p_hist bigint[],p_position int)
returns bigint[]
language plpgsql
immutable
set search_path=public
as $$
declare
  v bigint[] := coalesce(p_hist,array_fill(0::bigint,array[41]));
  pos int := greatest(1,least(41,p_position));
begin
  v[pos] := coalesce(v[pos],0)+1;
  return v;
end $$;

revoke all on function public.bump_histogram(bigint[],int) from public,anon,authenticated;

create or replace function public.record_question_numeric_answer(p_question_id uuid,p_guess numeric)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  actual numeric;
  log_ratio numeric;
  idx int;
  seeded bigint[];
begin
  if p_question_id is null or p_guess is null then return; end if;

  select q.answer_numeric into actual
  from public.questions q
  where q.id=p_question_id and q.question_type='numeric';

  if actual is null then return; end if;

  -- Positive Fermi estimates get a logarithmic ratio bucket. For the rare
  -- zero/negative numeric question, use a signed normalized error bucket.
  if actual>0 and p_guess>0 then
    log_ratio := greatest(-4::numeric,least(4::numeric,log(10,p_guess/actual)));
  else
    log_ratio := greatest(-4::numeric,least(4::numeric,(p_guess-actual)/greatest(abs(actual),1)));
  end if;

  idx := greatest(0,least(40,round((log_ratio+4)/0.2)::int));
  seeded := array_fill(0::bigint,array[41]);
  seeded[idx+1] := 1;

  insert into public.question_answer_stats(question_id,total_answers,histogram,first_answered_at,last_answered_at,updated_at)
  values(p_question_id,1,seeded,now(),now(),now())
  on conflict(question_id) do update
    set total_answers=public.question_answer_stats.total_answers+1,
        histogram=public.bump_histogram(public.question_answer_stats.histogram,idx+1),
        last_answered_at=now(),
        updated_at=now();
end $$;

revoke all on function public.record_question_numeric_answer(uuid,numeric) from public,anon,authenticated;

create or replace function public.capture_daily_numeric_answer()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.answer_numeric is not null then
    perform public.record_question_numeric_answer(new.question_id,new.answer_numeric);
  end if;
  return new;
end $$;

drop trigger if exists capture_daily_numeric_answer on public.daily_attempts;
create trigger capture_daily_numeric_answer after insert on public.daily_attempts
for each row execute function public.capture_daily_numeric_answer();

create or replace function public.capture_practice_numeric_answer()
returns trigger language plpgsql security definer set search_path=public as $$
declare qid uuid;
begin
  if new.answer_numeric is null then return new; end if;
  select pq.question_id into qid
  from public.practice_questions pq
  where pq.session_id=new.session_id and pq.ordinal=new.ordinal;
  if qid is not null then perform public.record_question_numeric_answer(qid,new.answer_numeric); end if;
  return new;
end $$;

drop trigger if exists capture_practice_numeric_answer on public.practice_answers;
create trigger capture_practice_numeric_answer after insert on public.practice_answers
for each row execute function public.capture_practice_numeric_answer();

create or replace function public.capture_game_numeric_answer()
returns trigger language plpgsql security definer set search_path=public as $$
declare qid uuid;
begin
  if new.answer_numeric is null then return new; end if;
  select gq.question_id into qid
  from public.game_questions gq
  where gq.game_id=new.game_id and gq.ordinal=new.ordinal;
  if qid is not null then perform public.record_question_numeric_answer(qid,new.answer_numeric); end if;
  return new;
end $$;

drop trigger if exists capture_game_numeric_answer on public.game_answers;
create trigger capture_game_numeric_answer after insert on public.game_answers
for each row execute function public.capture_game_numeric_answer();

-- Backfill existing numeric answers once. A non-empty stats table means this
-- migration (or live triggers) already populated it, so reruns do not double-count.
do $$
declare r record;
begin
  if not exists(select 1 from public.question_answer_stats limit 1) then
    for r in
      select d.question_id as qid,d.answer_numeric as guess from public.daily_attempts d where d.answer_numeric is not null
      union all
      select pq.question_id,pa.answer_numeric from public.practice_answers pa
        join public.practice_questions pq on pq.session_id=pa.session_id and pq.ordinal=pa.ordinal
        where pa.answer_numeric is not null
      union all
      select gq.question_id,ga.answer_numeric from public.game_answers ga
        join public.game_questions gq on gq.game_id=ga.game_id and gq.ordinal=ga.ordinal
        where ga.answer_numeric is not null
    loop
      perform public.record_question_numeric_answer(r.qid,r.guess);
    end loop;
  end if;
end $$;

create or replace function public.get_question_community_stats(p_question_id uuid)
returns table(
  total_answers bigint,
  histogram bigint[],
  bucket_min numeric,
  bucket_max numeric,
  bucket_step numeric,
  first_answered_at timestamptz,
  last_answered_at timestamptz
)
language sql
security definer
set search_path=public
as $$
  select
    coalesce(s.total_answers,0),
    coalesce(s.histogram,array_fill(0::bigint,array[41])),
    -4::numeric,
    4::numeric,
    0.2::numeric,
    s.first_answered_at,
    s.last_answered_at
  from (select 1) x
  left join public.question_answer_stats s on s.question_id=p_question_id;
$$;

grant execute on function public.get_question_community_stats(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Compact public Replay Library. A replay stores only an ordered uuid[] of
-- questions plus metadata. Question text/answers are NOT duplicated.
-- -----------------------------------------------------------------------------
create table if not exists public.library_sessions (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  title text not null,
  description text,
  source_kind text not null default 'practice' check(source_kind in ('practice','party','curated','imported')),
  created_by uuid references auth.users(id) on delete set null,
  categories text[] not null default array[]::text[],
  difficulty text not null default 'any',
  question_count integer not null check(question_count between 1 and 50),
  question_ids uuid[] not null,
  cover_image_url text,
  cover_image_alt text,
  cover_image_source_url text,
  cover_image_attribution text,
  cover_image_license text,
  cover_image_license_url text,
  play_count bigint not null default 0 check(play_count>=0),
  times_generated bigint not null default 1 check(times_generated>=1),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_session_question_count check(cardinality(question_ids)=question_count)
);

create index if not exists library_sessions_created_idx on public.library_sessions(created_at desc);
create index if not exists library_sessions_popular_idx on public.library_sessions(play_count desc,created_at desc);
create index if not exists library_sessions_categories_gin on public.library_sessions using gin(categories);

alter table public.library_sessions enable row level security;
revoke all on public.library_sessions from anon,authenticated;

alter table public.practice_sessions add column if not exists library_session_id uuid references public.library_sessions(id) on delete set null;
alter table public.practice_sessions add column if not exists origin_library_session_id uuid references public.library_sessions(id) on delete set null;
alter table public.games add column if not exists library_session_id uuid references public.library_sessions(id) on delete set null;

create or replace function public.make_library_snapshot(
  p_question_ids uuid[],
  p_source_kind text,
  p_created_by uuid,
  p_categories text[] default array[]::text[],
  p_difficulty text default 'any',
  p_title text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  fp text;
  lib_id uuid;
  cats text[];
  qcount int;
  auto_title text;
  cover record;
begin
  qcount:=coalesce(cardinality(p_question_ids),0);
  if qcount<1 then return null; end if;
  fp:=md5(array_to_string(p_question_ids,','));

  select coalesce(array_agg(distinct q.category order by q.category),array[]::text[])
  into cats
  from public.questions q
  where q.id=any(p_question_ids);

  if coalesce(cardinality(p_categories),0)>0 then cats:=p_categories; end if;

  auto_title:=coalesce(nullif(trim(p_title),''),
    case
      when cardinality(cats)=1 then cats[1]||' Replay • '||qcount||'Q'
      when cardinality(cats)=2 then cats[1]||' + '||cats[2]||' • '||qcount||'Q'
      else 'Mixed Knowledge • '||qcount||'Q'
    end);

  select q.image_url,q.image_alt,q.image_source_url,q.image_attribution,q.image_license,q.image_license_url
  into cover
  from unnest(p_question_ids) with ordinality ids(id,ord)
  join public.questions q on q.id=ids.id
  where q.image_url is not null
  order by ids.ord
  limit 1;

  insert into public.library_sessions(
    fingerprint,title,description,source_kind,created_by,categories,difficulty,question_count,question_ids,
    cover_image_url,cover_image_alt,cover_image_source_url,cover_image_attribution,cover_image_license,cover_image_license_url
  ) values(
    fp,auto_title,
    case when p_source_kind='party' then 'A completed Party Mode question set, preserved for replay.' else 'A completed Practice question set, preserved for replay.' end,
    case when p_source_kind in('practice','party','curated','imported') then p_source_kind else 'practice' end,
    p_created_by,cats,coalesce(p_difficulty,'any'),qcount,p_question_ids,
    cover.image_url,cover.image_alt,cover.image_source_url,cover.image_attribution,cover.image_license,cover.image_license_url
  )
  on conflict(fingerprint) do update
    set times_generated=public.library_sessions.times_generated+1,
        updated_at=now(),
        cover_image_url=coalesce(public.library_sessions.cover_image_url,excluded.cover_image_url),
        cover_image_alt=coalesce(public.library_sessions.cover_image_alt,excluded.cover_image_alt),
        cover_image_source_url=coalesce(public.library_sessions.cover_image_source_url,excluded.cover_image_source_url),
        cover_image_attribution=coalesce(public.library_sessions.cover_image_attribution,excluded.cover_image_attribution),
        cover_image_license=coalesce(public.library_sessions.cover_image_license,excluded.cover_image_license),
        cover_image_license_url=coalesce(public.library_sessions.cover_image_license_url,excluded.cover_image_license_url)
  returning id into lib_id;

  return lib_id;
end $$;

revoke all on function public.make_library_snapshot(uuid[],text,uuid,text[],text,text) from public,anon,authenticated;

create or replace function public.snapshot_completed_practice()
returns trigger language plpgsql security definer set search_path=public as $$
declare ids uuid[]; lib uuid;
begin
  if new.status='completed' and old.status is distinct from new.status and new.library_session_id is null then
    select array_agg(pq.question_id order by pq.ordinal) into ids
    from public.practice_questions pq where pq.session_id=new.id;
    lib:=public.make_library_snapshot(ids,'practice',new.user_id,new.categories,new.difficulty,null);
    update public.practice_sessions ps set library_session_id=lib where ps.id=new.id;
  end if;
  return new;
end $$;

drop trigger if exists snapshot_completed_practice on public.practice_sessions;
create trigger snapshot_completed_practice after update of status on public.practice_sessions
for each row execute function public.snapshot_completed_practice();

create or replace function public.snapshot_completed_game()
returns trigger language plpgsql security definer set search_path=public as $$
declare ids uuid[]; cats text[]; lib uuid;
begin
  if new.status='finished' and old.status is distinct from new.status and new.library_session_id is null then
    select array_agg(gq.question_id order by gq.ordinal) into ids
    from public.game_questions gq where gq.game_id=new.id;
    select coalesce(array_agg(distinct q.category order by q.category),array[]::text[]) into cats
    from public.game_questions gq join public.questions q on q.id=gq.question_id
    where gq.game_id=new.id;
    lib:=public.make_library_snapshot(ids,'party',new.host_id,cats,new.difficulty,null);
    update public.games g set library_session_id=lib where g.id=new.id;
  end if;
  return new;
end $$;

drop trigger if exists snapshot_completed_game on public.games;
create trigger snapshot_completed_game after update of status on public.games
for each row execute function public.snapshot_completed_game();

-- Snapshot already-completed rounds from before V6 once.
do $$
declare r record; ids uuid[]; cats text[]; lib uuid;
begin
  for r in select ps.* from public.practice_sessions ps where ps.status='completed' and ps.library_session_id is null loop
    select array_agg(pq.question_id order by pq.ordinal) into ids from public.practice_questions pq where pq.session_id=r.id;
    lib:=public.make_library_snapshot(ids,'practice',r.user_id,r.categories,r.difficulty,null);
    update public.practice_sessions set library_session_id=lib where id=r.id;
  end loop;

  for r in select g.* from public.games g where g.status='finished' and g.library_session_id is null loop
    select array_agg(gq.question_id order by gq.ordinal) into ids from public.game_questions gq where gq.game_id=r.id;
    select coalesce(array_agg(distinct q.category order by q.category),array[]::text[]) into cats
    from public.game_questions gq join public.questions q on q.id=gq.question_id where gq.game_id=r.id;
    lib:=public.make_library_snapshot(ids,'party',r.host_id,cats,r.difficulty,null);
    update public.games set library_session_id=lib where id=r.id;
  end loop;
end $$;

create or replace function public.get_library_sessions(
  p_search text default null,
  p_category text default null,
  p_difficulty text default null,
  p_sort text default 'new',
  p_limit int default 30,
  p_offset int default 0
)
returns table(
  id uuid,title text,description text,source_kind text,categories text[],difficulty text,question_count int,
  cover_image_url text,cover_image_alt text,cover_image_source_url text,cover_image_attribution text,
  cover_image_license text,cover_image_license_url text,play_count bigint,times_generated bigint,created_at timestamptz,
  total_count bigint
)
language plpgsql security definer set search_path=public as $$
begin
  return query
  select
    ls.id,ls.title,ls.description,ls.source_kind,ls.categories,ls.difficulty,ls.question_count,
    ls.cover_image_url,ls.cover_image_alt,ls.cover_image_source_url,ls.cover_image_attribution,
    ls.cover_image_license,ls.cover_image_license_url,ls.play_count,ls.times_generated,ls.created_at,
    count(*) over() as total_count
  from public.library_sessions ls
  where ls.is_public
    and (nullif(trim(coalesce(p_search,'')),'') is null
      or ls.title ilike '%'||trim(p_search)||'%'
      or coalesce(ls.description,'') ilike '%'||trim(p_search)||'%')
    and (nullif(trim(coalesce(p_category,'')),'') is null or p_category=any(ls.categories))
    and (coalesce(p_difficulty,'any')='any' or ls.difficulty=p_difficulty or ls.difficulty='any')
  order by
    case when p_sort='popular' then ls.play_count end desc nulls last,
    case when p_sort='popular' then ls.times_generated end desc nulls last,
    ls.created_at desc
  limit greatest(1,least(60,coalesce(p_limit,30)))
  offset greatest(0,coalesce(p_offset,0));
end $$;

grant execute on function public.get_library_sessions(text,text,text,text,int,int) to anon,authenticated;

create or replace function public.start_library_practice(p_library_session_id uuid)
returns table(session_id uuid,question_count int,current_index int,status text,total_score int)
language plpgsql security definer set search_path=public as $$
declare ls public.library_sessions; sid uuid; i record;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select x.* into ls from public.library_sessions x where x.id=p_library_session_id and x.is_public for update;
  if ls.id is null then raise exception 'Library session not found'; end if;

  insert into public.practice_sessions(user_id,categories,difficulty,question_count,origin_library_session_id)
  values(auth.uid(),ls.categories,ls.difficulty,ls.question_count,ls.id)
  returning id into sid;

  insert into public.practice_questions(session_id,ordinal,question_id)
  select sid,(u.ord-1)::int,u.qid
  from unnest(ls.question_ids) with ordinality u(qid,ord)
  order by u.ord;

  update public.library_sessions x set play_count=x.play_count+1,updated_at=now() where x.id=ls.id;
  return query select sid,ls.question_count,0,'active'::text,0;
end $$;

grant execute on function public.start_library_practice(uuid) to authenticated;

-- Keep the Replay Library permanent while allowing raw completed Practice runs
-- to be pruned. This is safe because library_sessions stores the ordered question ids.
create or replace function public.prune_ephemeral_practice(p_days int default 30)
returns bigint
language plpgsql security definer set search_path=public as $$
declare deleted_count bigint;
begin
  delete from public.practice_sessions ps
  where ps.status='completed'
    and ps.completed_at < now()-make_interval(days=>greatest(7,least(365,coalesce(p_days,30))));
  get diagnostics deleted_count = row_count;
  return deleted_count;
end $$;

revoke all on function public.prune_ephemeral_practice(int) from public,anon,authenticated;
grant execute on function public.prune_ephemeral_practice(int) to service_role;

-- -----------------------------------------------------------------------------
-- V6 media-aware question RPCs. Versioned names avoid changing the declared
-- return types of existing RPCs in-place.
-- -----------------------------------------------------------------------------
create or replace function public.get_daily_state_v6()
returns table(
  id uuid,daily_number bigint,category text,difficulty text,question_type text,prompt text,context text,unit text,options jsonb,
  image_url text,image_alt text,image_source_url text,image_attribution text,image_license text,image_license_url text,
  already_played boolean,score int,xp_awarded int,your_answer numeric,answer_numeric numeric,answer_text text,answer_display text,explanation text
)
language sql security definer set search_path=public as $$
  with mine as (
    select d.* from public.daily_attempts d where d.day=current_date and d.user_id=auth.uid() limit 1
  ), chosen as (
    select coalesce((select question_id from mine),public.daily_question_id(current_date)) as question_id
  )
  select q.id,(current_date-date '2026-01-01')::bigint+1,q.category,q.difficulty,q.question_type,q.prompt,q.context,q.unit,q.options,
    q.image_url,q.image_alt,q.image_source_url,q.image_attribution,q.image_license,q.image_license_url,
    exists(select 1 from mine),d.score,d.xp_awarded,d.answer_numeric,
    case when d.user_id is not null then q.answer_numeric else null end,
    case when d.user_id is not null then q.answer_text else null end,
    case when d.user_id is not null and q.question_type='multiple_choice' then q.options->>q.correct_option else null end,
    case when d.user_id is not null then q.explanation else null end
  from chosen c join public.questions q on q.id=c.question_id left join mine d on true;
$$;

grant execute on function public.get_daily_state_v6() to authenticated;

create or replace function public.get_practice_question_v6(p_session_id uuid)
returns table(
  session_id uuid,ordinal int,question_count int,total_score int,status text,id uuid,category text,difficulty text,question_type text,
  prompt text,context text,unit text,options jsonb,image_url text,image_alt text,image_source_url text,image_attribution text,
  image_license text,image_license_url text,answered boolean,score int,your_answer text,answer_numeric numeric,answer_text text,
  answer_display text,explanation text
)
language plpgsql security definer set search_path=public as $$
declare s_rec public.practice_sessions;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select ps.* into s_rec from public.practice_sessions ps where ps.id=p_session_id and ps.user_id=auth.uid();
  if s_rec.id is null then raise exception 'Practice session not found'; end if;

  return query
  select s_rec.id,s_rec.current_index,s_rec.question_count,s_rec.total_score,s_rec.status,q.id,q.category,q.difficulty,q.question_type,
    q.prompt,q.context,q.unit,q.options,q.image_url,q.image_alt,q.image_source_url,q.image_attribution,q.image_license,q.image_license_url,
    (pa.session_id is not null),pa.score,pa.answer_value,
    case when pa.session_id is not null then q.answer_numeric else null end,
    case when pa.session_id is not null then q.answer_text else null end,
    case when pa.session_id is null then null when q.question_type='multiple_choice' then q.options->>q.correct_option when q.question_type='text' then q.answer_text else q.answer_numeric::text end,
    case when pa.session_id is not null then q.explanation else null end
  from public.practice_questions pq
  join public.questions q on q.id=pq.question_id
  left join public.practice_answers pa on pa.session_id=pq.session_id and pa.ordinal=pq.ordinal
  where pq.session_id=s_rec.id and pq.ordinal=s_rec.current_index;
end $$;

grant execute on function public.get_practice_question_v6(uuid) to authenticated;

create or replace function public.get_current_question_v6(p_game_id uuid)
returns table(
  id uuid,ordinal int,category text,difficulty text,question_type text,prompt text,context text,unit text,options jsonb,
  image_url text,image_alt text,image_source_url text,image_attribution text,image_license text,image_license_url text,
  answer_numeric numeric,answer_text text,answer_display text,explanation text
)
language plpgsql security definer set search_path=public as $$
declare g_rec public.games;
begin
  select g0.* into g_rec from public.games g0 where g0.id=p_game_id;
  if g_rec.id is null then raise exception 'Game not found'; end if;
  if not exists(select 1 from public.game_players gp where gp.game_id=p_game_id and gp.user_id=auth.uid()) then raise exception 'Not in game'; end if;

  return query
  select q.id,g_rec.current_question_index,q.category,q.difficulty,q.question_type,q.prompt,q.context,q.unit,q.options,
    q.image_url,q.image_alt,q.image_source_url,q.image_attribution,q.image_license,q.image_license_url,
    case when g_rec.status in('results','finished') then q.answer_numeric else null end,
    case when g_rec.status in('results','finished') then q.answer_text else null end,
    case when g_rec.status in('results','finished') and q.question_type='multiple_choice' then q.options->>q.correct_option else null end,
    case when g_rec.status in('results','finished') then q.explanation else null end
  from public.game_questions gq join public.questions q on q.id=gq.question_id
  where gq.game_id=p_game_id and gq.ordinal=g_rec.current_question_index;
end $$;

grant execute on function public.get_current_question_v6(uuid) to authenticated;
