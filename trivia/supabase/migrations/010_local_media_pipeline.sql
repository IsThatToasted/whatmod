-- WhatMod Trivia V9
-- Local media resolver export/import pipeline + V1 default theme.
-- Safe to run after 009_release_ui_theme.sql.

begin;

-- V1 becomes the default/release theme again. Existing explicit user choices are preserved.
alter table public.profiles
  alter column ui_theme set default 'v1';

create or replace function public.admin_export_media_job(
  p_scope text default 'missing',
  p_limit integer default 1000
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  out_json jsonb;
  scope_name text := lower(trim(coalesce(p_scope,'missing')));
  safe_limit integer := greatest(1, least(coalesce(p_limit,1000),5000));
begin
  if not public.is_trivia_admin() then
    raise exception 'Admin only';
  end if;

  if scope_name not in ('missing','needs_review','auto','all_unlocked') then
    raise exception 'Invalid export scope';
  end if;

  with picked as (
    select q.*
    from public.questions q
    where q.is_active
      and q.media_locked=false
      and (
        (scope_name='missing' and q.image_url is null)
        or (scope_name='needs_review' and (q.image_url is null or q.media_review_status in ('unreviewed','auto')))
        or (scope_name='auto' and q.media_review_status='auto')
        or scope_name='all_unlocked'
      )
    order by
      case when q.image_url is null then 0 else 1 end,
      q.media_last_resolved_at asc nulls first,
      q.created_at asc
    limit safe_limit
  )
  select jsonb_build_object(
    'format','whatmod-trivia-media-job',
    'version',1,
    'job_id',gen_random_uuid(),
    'scope',scope_name,
    'exported_at',now(),
    'question_count',(select count(*) from picked),
    'questions',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',q.id,
          'prompt',q.prompt,
          'category',q.category,
          'difficulty',q.difficulty,
          'media_query',q.media_query,
          'source_type',q.source_type,
          'source_entity_id',q.source_entity_id,
          'source_url',q.source_url,
          'image_url',q.image_url,
          'image_alt',q.image_alt,
          'image_source_url',q.image_source_url,
          'image_attribution',q.image_attribution,
          'image_license',q.image_license,
          'image_license_url',q.image_license_url,
          'media_provider',q.media_provider,
          'media_review_status',q.media_review_status,
          'rejected_candidates',coalesce((
            select jsonb_agg(jsonb_build_object(
              'provider',c.provider,
              'provider_key',c.provider_key
            ))
            from public.question_media_candidates c
            where c.question_id=q.id and c.status='rejected'
          ),'[]'::jsonb)
        )
        order by q.created_at asc
      )
      from picked q
    ),'[]'::jsonb)
  ) into out_json;

  return out_json;
end $$;

create or replace function public.admin_import_media_results(
  p_results jsonb,
  p_auto_publish boolean default true,
  p_skip_locked boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  item jsonb;
  cand jsonb;
  qid uuid;
  qrow public.questions;
  cid uuid;
  selected_provider text;
  selected_key text;
  selected_manual boolean;
  selected_candidate public.question_media_candidates;
  imported_questions integer := 0;
  imported_candidates integer := 0;
  published_questions integer := 0;
  skipped_locked integer := 0;
  skipped_missing integer := 0;
begin
  if not public.is_trivia_admin() then
    raise exception 'Admin only';
  end if;

  if jsonb_typeof(coalesce(p_results,'[]'::jsonb)) <> 'array' then
    raise exception 'p_results must be a JSON array';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_results,'[]'::jsonb))
  loop
    begin
      qid := (item->>'id')::uuid;
    exception when others then
      qid := null;
    end;

    if qid is null then
      skipped_missing := skipped_missing + 1;
      continue;
    end if;

    select q.* into qrow from public.questions q where q.id=qid for update;
    if qrow.id is null then
      skipped_missing := skipped_missing + 1;
      continue;
    end if;

    if coalesce(p_skip_locked,true) and qrow.media_locked then
      skipped_locked := skipped_locked + 1;
      continue;
    end if;

    imported_questions := imported_questions + 1;

    if nullif(trim(item->>'query'),'') is not null then
      update public.questions q
      set media_query=left(trim(item->>'query'),500)
      where q.id=qid;
    end if;

    if jsonb_typeof(item->'candidates')='array' then
      for cand in select value from jsonb_array_elements(item->'candidates')
      loop
        if nullif(trim(cand->>'provider'),'') is null
           or nullif(trim(cand->>'provider_key'),'') is null
           or nullif(trim(cand->>'image_url'),'') is null then
          continue;
        end if;

        insert into public.question_media_candidates(
          question_id,provider,provider_key,title,image_url,thumbnail_url,source_url,
          creator,creator_url,license,license_url,width,height,score,auto_eligible,
          is_available,status,metadata,updated_at,last_checked_at
        ) values (
          qid,
          left(trim(cand->>'provider'),60),
          left(trim(cand->>'provider_key'),240),
          nullif(left(trim(coalesce(cand->>'title','')),500),''),
          trim(cand->>'image_url'),
          nullif(trim(coalesce(cand->>'thumbnail_url','')),''),
          nullif(trim(coalesce(cand->>'source_url','')),''),
          nullif(left(trim(coalesce(cand->>'creator','')),500),''),
          nullif(trim(coalesce(cand->>'creator_url','')),''),
          nullif(left(trim(coalesce(cand->>'license','')),200),''),
          nullif(trim(coalesce(cand->>'license_url','')),''),
          case when (cand->>'width') ~ '^[0-9]+$' then (cand->>'width')::integer else null end,
          case when (cand->>'height') ~ '^[0-9]+$' then (cand->>'height')::integer else null end,
          case when coalesce(cand->>'score','') ~ '^-?[0-9]+([.][0-9]+)?$' then (cand->>'score')::numeric else 0 end,
          coalesce((cand->>'auto_eligible')::boolean,false),
          coalesce((cand->>'is_available')::boolean,false),
          'candidate',
          coalesce(cand->'metadata','{}'::jsonb),
          now(),now()
        )
        on conflict(question_id,provider,provider_key) do update set
          title=excluded.title,
          image_url=excluded.image_url,
          thumbnail_url=excluded.thumbnail_url,
          source_url=excluded.source_url,
          creator=excluded.creator,
          creator_url=excluded.creator_url,
          license=excluded.license,
          license_url=excluded.license_url,
          width=excluded.width,
          height=excluded.height,
          score=excluded.score,
          auto_eligible=excluded.auto_eligible,
          is_available=excluded.is_available,
          metadata=excluded.metadata,
          status=case
            when public.question_media_candidates.status='rejected' then 'rejected'
            else 'candidate'
          end,
          updated_at=now(),
          last_checked_at=now()
        returning id into cid;

        imported_candidates := imported_candidates + 1;
      end loop;
    end if;

    selected_provider := nullif(trim(item#>>'{selected,provider}'),'');
    selected_key := nullif(trim(item#>>'{selected,provider_key}'),'');
    selected_manual := lower(coalesce(item->>'selection_mode','auto'))='manual';

    if selected_provider is not null and selected_key is not null then
      select c.* into selected_candidate
      from public.question_media_candidates c
      where c.question_id=qid
        and c.provider=selected_provider
        and c.provider_key=selected_key
        and c.status<>'rejected'
        and c.is_available=true
      limit 1;

      if selected_candidate.id is not null
         and coalesce(p_auto_publish,true)
         and (selected_candidate.auto_eligible or selected_manual) then

        update public.question_media_candidates c
        set status=case
          when c.id=selected_candidate.id then 'auto_selected'
          when c.status in ('selected','auto_selected') then 'candidate'
          else c.status
        end,
        updated_at=now()
        where c.question_id=qid and c.status<>'rejected';

        update public.questions q set
          image_url=coalesce(nullif(selected_candidate.thumbnail_url,''),selected_candidate.image_url),
          image_alt=coalesce(nullif(selected_candidate.title,''),q.media_query,q.image_alt,q.prompt),
          image_source_url=selected_candidate.source_url,
          image_attribution=selected_candidate.creator,
          image_license=selected_candidate.license,
          image_license_url=selected_candidate.license_url,
          media_provider=selected_candidate.provider,
          media_candidate_id=selected_candidate.id,
          media_review_status='auto',
          media_locked=false,
          media_updated_at=now(),
          media_last_resolved_at=now()
        where q.id=qid;

        published_questions := published_questions + 1;
      else
        update public.questions q
        set media_last_resolved_at=now(),media_updated_at=now()
        where q.id=qid;
      end if;
    else
      update public.questions q
      set media_last_resolved_at=now(),media_updated_at=now()
      where q.id=qid;
    end if;
  end loop;

  return jsonb_build_object(
    'imported_questions',imported_questions,
    'imported_candidates',imported_candidates,
    'published_questions',published_questions,
    'skipped_locked',skipped_locked,
    'skipped_missing',skipped_missing
  );
end $$;

revoke all on function public.admin_export_media_job(text,integer) from public,anon;
revoke all on function public.admin_import_media_results(jsonb,boolean,boolean) from public,anon;

grant execute on function public.admin_export_media_job(text,integer) to authenticated;
grant execute on function public.admin_import_media_results(jsonb,boolean,boolean) to authenticated;

commit;
