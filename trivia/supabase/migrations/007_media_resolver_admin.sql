-- WhatMod Trivia V7
-- Media Resolver V2 + /triviaadmin moderation APIs
-- Safe to run after 006_library_community_media.sql.

begin;

alter table public.questions add column if not exists media_query text;
alter table public.questions add column if not exists media_provider text;
alter table public.questions add column if not exists media_review_status text not null default 'unreviewed';
alter table public.questions add column if not exists media_locked boolean not null default false;
alter table public.questions add column if not exists media_candidate_id uuid;
alter table public.questions add column if not exists media_updated_at timestamptz;
alter table public.questions add column if not exists media_last_resolved_at timestamptz;

-- Existing media remains visible immediately. It is simply marked as auto/unreviewed
-- until an admin explicitly approves/locks it.
update public.questions q
set media_review_status = case
      when q.image_url is not null and q.media_review_status='unreviewed' then 'auto'
      else q.media_review_status
    end,
    media_provider = coalesce(q.media_provider,
      case
        when q.image_source_url ilike '%commons.wikimedia.org%' then 'wikimedia'
        when q.image_source_url ilike '%wikipedia.org%' then 'wikipedia'
        when q.image_source_url ilike '%openverse.org%' then 'openverse'
        else null
      end),
    media_query = coalesce(nullif(q.media_query,''), nullif(q.image_alt,'')),
    media_updated_at = coalesce(q.media_updated_at, case when q.image_url is not null then now() else null end)
where q.image_url is not null or q.image_alt is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.questions'::regclass and conname='questions_media_review_status_check'
  ) then
    alter table public.questions add constraint questions_media_review_status_check
      check (media_review_status in ('unreviewed','auto','approved','rejected','none'));
  end if;
end $$;

create table if not exists public.question_media_candidates (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  provider text not null,
  provider_key text not null,
  title text,
  image_url text not null,
  thumbnail_url text,
  source_url text,
  creator text,
  creator_url text,
  license text,
  license_url text,
  width integer,
  height integer,
  score numeric not null default 0,
  auto_eligible boolean not null default false,
  is_available boolean not null default true,
  status text not null default 'candidate',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_checked_at timestamptz,
  unique(question_id,provider,provider_key),
  constraint question_media_candidate_status_check
    check (status in ('candidate','auto_selected','selected','approved','rejected'))
);

create index if not exists question_media_candidates_question_idx
  on public.question_media_candidates(question_id, status, score desc);
create index if not exists question_media_candidates_provider_idx
  on public.question_media_candidates(provider, updated_at desc);

alter table public.question_media_candidates enable row level security;
revoke all on public.question_media_candidates from public,anon,authenticated;

-- Keep candidate FK optional so older installs remain migration-friendly.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.questions'::regclass and conname='questions_media_candidate_fk'
  ) then
    alter table public.questions
      add constraint questions_media_candidate_fk
      foreign key (media_candidate_id)
      references public.question_media_candidates(id)
      on delete set null;
  end if;
end $$;

create or replace function public.is_trivia_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.profiles p
    where p.user_id=auth.uid() and p.is_admin=true
  );
$$;

revoke all on function public.is_trivia_admin() from public,anon;
grant execute on function public.is_trivia_admin() to authenticated;

create or replace function public.admin_media_overview()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare out_json jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select jsonb_build_object(
    'total_questions', count(*),
    'with_image', count(*) filter (where q.image_url is not null),
    'missing_image', count(*) filter (where q.image_url is null),
    'approved', count(*) filter (where q.media_review_status='approved'),
    'auto', count(*) filter (where q.media_review_status='auto'),
    'locked', count(*) filter (where q.media_locked),
    'needs_resolution', count(*) filter (where not q.media_locked and q.image_url is null),
    'candidates', (select count(*) from public.question_media_candidates c),
    'last_resolved_at', max(q.media_last_resolved_at)
  ) into out_json
  from public.questions q
  where q.is_active;
  return out_json;
end $$;

create or replace function public.admin_list_media_questions(
  p_search text default null,
  p_media_filter text default 'all',
  p_provider text default null,
  p_category text default null,
  p_limit integer default 40,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare out_json jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  p_limit:=greatest(1,least(coalesce(p_limit,40),100));
  p_offset:=greatest(0,coalesce(p_offset,0));

  with filtered as (
    select q.*
    from public.questions q
    where q.is_active
      and (p_search is null or trim(p_search)='' or q.prompt ilike '%'||trim(p_search)||'%' or coalesce(q.media_query,'') ilike '%'||trim(p_search)||'%')
      and (p_provider is null or trim(p_provider)='' or q.media_provider=p_provider)
      and (p_category is null or trim(p_category)='' or q.category=p_category)
      and (
        coalesce(p_media_filter,'all')='all'
        or (p_media_filter='missing' and q.image_url is null)
        or (p_media_filter='auto' and q.media_review_status='auto')
        or (p_media_filter='approved' and q.media_review_status='approved')
        or (p_media_filter='locked' and q.media_locked)
        or (p_media_filter='unreviewed' and q.media_review_status in ('unreviewed','auto'))
        or (p_media_filter='rejected' and q.media_review_status='rejected')
      )
  ), paged as (
    select f.*
    from filtered f
    order by
      case when f.image_url is null then 0 else 1 end,
      coalesce(f.media_updated_at,f.created_at) desc,
      f.created_at desc
    limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'total',(select count(*) from filtered),
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'prompt',p.prompt,'category',p.category,'difficulty',p.difficulty,
      'source_url',p.source_url,'source_type',p.source_type,'source_entity_id',p.source_entity_id,
      'media_query',p.media_query,'image_url',p.image_url,'image_alt',p.image_alt,
      'image_source_url',p.image_source_url,'image_attribution',p.image_attribution,
      'image_license',p.image_license,'image_license_url',p.image_license_url,
      'media_provider',p.media_provider,'media_review_status',p.media_review_status,
      'media_locked',p.media_locked,'media_candidate_id',p.media_candidate_id,
      'media_updated_at',p.media_updated_at,'media_last_resolved_at',p.media_last_resolved_at,
      'candidate_count',(select count(*) from public.question_media_candidates c where c.question_id=p.id and c.status<>'rejected')
    )) from paged p),'[]'::jsonb)
  ) into out_json;
  return out_json;
end $$;

create or replace function public.admin_get_question_media(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare out_json jsonb;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select jsonb_build_object(
    'question', jsonb_build_object(
      'id',q.id,'prompt',q.prompt,'category',q.category,'difficulty',q.difficulty,
      'source_url',q.source_url,'source_type',q.source_type,'source_entity_id',q.source_entity_id,
      'media_query',q.media_query,'image_url',q.image_url,'image_alt',q.image_alt,
      'image_source_url',q.image_source_url,'image_attribution',q.image_attribution,
      'image_license',q.image_license,'image_license_url',q.image_license_url,
      'media_provider',q.media_provider,'media_review_status',q.media_review_status,
      'media_locked',q.media_locked,'media_candidate_id',q.media_candidate_id,
      'media_updated_at',q.media_updated_at,'media_last_resolved_at',q.media_last_resolved_at
    ),
    'candidates',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'provider',c.provider,'provider_key',c.provider_key,'title',c.title,
      'image_url',c.image_url,'thumbnail_url',c.thumbnail_url,'source_url',c.source_url,
      'creator',c.creator,'creator_url',c.creator_url,'license',c.license,'license_url',c.license_url,
      'width',c.width,'height',c.height,'score',c.score,'auto_eligible',c.auto_eligible,
      'is_available',c.is_available,'status',c.status,'metadata',c.metadata,
      'updated_at',c.updated_at,'last_checked_at',c.last_checked_at
    ) order by
      case c.status when 'approved' then 0 when 'selected' then 1 when 'auto_selected' then 2 else 3 end,
      c.score desc,c.updated_at desc)
      from public.question_media_candidates c where c.question_id=q.id),'[]'::jsonb)
  ) into out_json
  from public.questions q where q.id=p_question_id;
  if out_json is null then raise exception 'Question not found'; end if;
  return out_json;
end $$;

create or replace function public.admin_select_media_candidate(
  p_question_id uuid,
  p_candidate_id uuid,
  p_approve boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare c public.question_media_candidates; chosen_url text;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select x.* into c from public.question_media_candidates x
  where x.id=p_candidate_id and x.question_id=p_question_id and x.status<>'rejected';
  if c.id is null then raise exception 'Media candidate not found'; end if;
  chosen_url:=coalesce(nullif(c.thumbnail_url,''),c.image_url);

  update public.question_media_candidates x
  set status=case when x.id=c.id then case when p_approve then 'approved' else 'selected' end
                  when x.status in ('selected','auto_selected','approved') then 'candidate'
                  else x.status end,
      updated_at=now()
  where x.question_id=p_question_id and x.status<>'rejected';

  update public.questions q set
    image_url=chosen_url,
    image_alt=coalesce(nullif(c.title,''),q.media_query,q.image_alt,q.prompt),
    image_source_url=c.source_url,
    image_attribution=c.creator,
    image_license=c.license,
    image_license_url=c.license_url,
    media_provider=c.provider,
    media_candidate_id=c.id,
    media_review_status=case when p_approve then 'approved' else 'auto' end,
    media_locked=coalesce(p_approve,false),
    media_updated_at=now()
  where q.id=p_question_id;

  return public.admin_get_question_media(p_question_id);
end $$;

create or replace function public.admin_use_external_media(
  p_question_id uuid,
  p_provider text,
  p_provider_key text,
  p_title text,
  p_image_url text,
  p_thumbnail_url text default null,
  p_source_url text default null,
  p_creator text default null,
  p_creator_url text default null,
  p_license text default null,
  p_license_url text default null,
  p_width integer default null,
  p_height integer default null,
  p_score numeric default 100,
  p_auto_eligible boolean default false,
  p_approve boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare cid uuid; normalized_provider text; normalized_key text;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  if p_image_url is null or trim(p_image_url)='' then raise exception 'Image URL required'; end if;
  normalized_provider:=left(coalesce(nullif(trim(p_provider),''),'manual'),60);
  normalized_key:=left(coalesce(nullif(trim(p_provider_key),''),md5(p_image_url)),240);

  insert into public.question_media_candidates(
    question_id,provider,provider_key,title,image_url,thumbnail_url,source_url,creator,creator_url,
    license,license_url,width,height,score,auto_eligible,is_available,status,updated_at,last_checked_at
  ) values(
    p_question_id,normalized_provider,normalized_key,nullif(trim(p_title),''),trim(p_image_url),nullif(trim(p_thumbnail_url),''),
    nullif(trim(p_source_url),''),nullif(trim(p_creator),''),nullif(trim(p_creator_url),''),nullif(trim(p_license),''),
    nullif(trim(p_license_url),''),p_width,p_height,coalesce(p_score,100),coalesce(p_auto_eligible,false),true,'candidate',now(),now()
  ) on conflict(question_id,provider,provider_key) do update set
    title=excluded.title,image_url=excluded.image_url,thumbnail_url=excluded.thumbnail_url,
    source_url=excluded.source_url,creator=excluded.creator,creator_url=excluded.creator_url,
    license=excluded.license,license_url=excluded.license_url,width=excluded.width,height=excluded.height,
    score=excluded.score,auto_eligible=excluded.auto_eligible,is_available=true,
    status=case when public.question_media_candidates.status='rejected' then 'candidate' else public.question_media_candidates.status end,
    updated_at=now(),last_checked_at=now()
  returning id into cid;

  return public.admin_select_media_candidate(p_question_id,cid,p_approve);
end $$;

create or replace function public.admin_approve_current_media(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  update public.questions q
  set media_review_status='approved',media_locked=true,media_updated_at=now()
  where q.id=p_question_id and q.image_url is not null;
  update public.question_media_candidates c
  set status='approved',updated_at=now()
  where c.id=(select q.media_candidate_id from public.questions q where q.id=p_question_id);
  return public.admin_get_question_media(p_question_id);
end $$;

create or replace function public.admin_reject_media_candidate(p_candidate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare qid uuid; was_current boolean;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  select c.question_id into qid from public.question_media_candidates c where c.id=p_candidate_id;
  if qid is null then raise exception 'Candidate not found'; end if;
  select exists(select 1 from public.questions q where q.id=qid and q.media_candidate_id=p_candidate_id) into was_current;
  update public.question_media_candidates c set status='rejected',is_available=false,updated_at=now() where c.id=p_candidate_id;
  if was_current then
    update public.questions q set image_url=null,image_source_url=null,image_attribution=null,image_license=null,image_license_url=null,
      media_candidate_id=null,media_provider=null,media_review_status='unreviewed',media_locked=false,media_updated_at=now(),media_last_resolved_at=null
    where q.id=qid;
  end if;
  return public.admin_get_question_media(qid);
end $$;

create or replace function public.admin_clear_question_media(p_question_id uuid,p_lock boolean default true)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  update public.question_media_candidates c
    set status=case when c.status in ('selected','auto_selected','approved') then 'candidate' else c.status end,updated_at=now()
    where c.question_id=p_question_id;
  update public.questions q set
    image_url=null,image_alt=null,image_source_url=null,image_attribution=null,image_license=null,image_license_url=null,
    media_provider=null,media_candidate_id=null,media_review_status=case when p_lock then 'none' else 'unreviewed' end,
    media_locked=coalesce(p_lock,true),media_updated_at=now(),media_last_resolved_at=case when p_lock then now() else null end
  where q.id=p_question_id;
  return public.admin_get_question_media(p_question_id);
end $$;

create or replace function public.admin_unlock_question_media(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  update public.questions q set media_locked=false,
    media_review_status=case when q.image_url is null then 'unreviewed' else 'auto' end,
    media_last_resolved_at=null,media_updated_at=now()
  where q.id=p_question_id;
  return public.admin_get_question_media(p_question_id);
end $$;

create or replace function public.admin_update_media_query(p_question_id uuid,p_query text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  update public.questions q set media_query=nullif(trim(p_query),''),media_last_resolved_at=null,media_updated_at=now()
  where q.id=p_question_id;
  return public.admin_get_question_media(p_question_id);
end $$;

revoke all on function public.admin_media_overview() from public,anon;
revoke all on function public.admin_list_media_questions(text,text,text,text,integer,integer) from public,anon;
revoke all on function public.admin_get_question_media(uuid) from public,anon;
revoke all on function public.admin_select_media_candidate(uuid,uuid,boolean) from public,anon;
revoke all on function public.admin_use_external_media(uuid,text,text,text,text,text,text,text,text,text,text,integer,integer,numeric,boolean,boolean) from public,anon;
revoke all on function public.admin_approve_current_media(uuid) from public,anon;
revoke all on function public.admin_reject_media_candidate(uuid) from public,anon;
revoke all on function public.admin_clear_question_media(uuid,boolean) from public,anon;
revoke all on function public.admin_unlock_question_media(uuid) from public,anon;
revoke all on function public.admin_update_media_query(uuid,text) from public,anon;

grant execute on function public.admin_media_overview() to authenticated;
grant execute on function public.admin_list_media_questions(text,text,text,text,integer,integer) to authenticated;
grant execute on function public.admin_get_question_media(uuid) to authenticated;
grant execute on function public.admin_select_media_candidate(uuid,uuid,boolean) to authenticated;
grant execute on function public.admin_use_external_media(uuid,text,text,text,text,text,text,text,text,text,text,integer,integer,numeric,boolean,boolean) to authenticated;
grant execute on function public.admin_approve_current_media(uuid) to authenticated;
grant execute on function public.admin_reject_media_candidate(uuid) to authenticated;
grant execute on function public.admin_clear_question_media(uuid,boolean) to authenticated;
grant execute on function public.admin_unlock_question_media(uuid) to authenticated;
grant execute on function public.admin_update_media_query(uuid,text) to authenticated;

commit;
