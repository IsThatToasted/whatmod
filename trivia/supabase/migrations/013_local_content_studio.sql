-- WhatMod Trivia V12
-- Local Content Studio: question hydration + media in one admin-imported package.
-- Safe to run after 012_multiplayer_autoflow.sql.

begin;

alter table public.questions add column if not exists content_locked boolean not null default false;

-- Manual questions are admin-owned content and should never be overwritten by automated hydration.
update public.questions q
set content_locked=true
where coalesce(q.source_type,'manual')='manual' and not q.content_locked;

-- Replace manual-create function so new admin-authored questions are content locked.
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

  insert into public.questions(
    category,difficulty,question_type,prompt,context,unit,options,answer_numeric,answer_text,correct_option,
    explanation,source_url,is_active,created_by,source_type,media_query,updated_at,content_locked
  ) values(
    coalesce(nullif(trim(p_payload->>'category'),''),'General'),p_payload->>'difficulty',qtype,trim(p_payload->>'prompt'),
    nullif(trim(p_payload->>'context'),''),nullif(trim(p_payload->>'unit'),''),
    case when qtype='multiple_choice' then opts else null end,
    case when qtype='numeric' then numeric_ans else null end,
    case when qtype='text' then text_ans else null end,
    case when qtype='multiple_choice' then correct else null end,
    nullif(trim(p_payload->>'explanation'),''),nullif(trim(p_payload->>'source_url'),''),true,auth.uid(),'manual',
    nullif(trim(p_payload->>'media_query'),''),now(),true
  ) returning * into q;

  perform public._audit_question_admin(q.id,'create',null,to_jsonb(q),jsonb_build_object('origin','triviaadmin','content_locked',true));
  return public.admin_get_question_v10(q.id);
end $$;

-- Any manual admin edit becomes authoritative and protects the question from future hydrator factual overwrites.
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
    content_locked=true,
    updated_at=now()
  where q.id=p_question_id returning * into after_q;

  if after_q.difficulty not in ('easy','medium','hard') then raise exception 'Invalid difficulty'; end if;
  perform public._audit_question_admin(p_question_id,'edit',to_jsonb(before_q),to_jsonb(after_q),jsonb_build_object('origin','triviaadmin','content_locked',true));
  return public.admin_get_question_v10(p_question_id);
end $$;

-- One chunk of a V12 content package. The browser splits one uploaded package into chunks
-- to avoid oversized HTTP/RPC payloads, but the user still performs one upload action.
create or replace function public.admin_import_content_package_v12(
  p_questions jsonb,
  p_package_id text default null,
  p_auto_publish boolean default true,
  p_preserve_content_locked boolean default true,
  p_preserve_media_locked boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  item jsonb;
  media jsonb;
  cand jsonb;
  before_q public.questions;
  after_q public.questions;
  qid uuid;
  canonical text;
  qtype text;
  opts jsonb;
  selected_provider text;
  selected_key text;
  selected_manual boolean;
  selected_candidate public.question_media_candidates;
  cid uuid;
  incoming_core jsonb;
  existing_core jsonb;
  created_count int:=0;
  updated_count int:=0;
  unchanged_count int:=0;
  content_locked_count int:=0;
  retired_count int:=0;
  media_locked_count int:=0;
  imported_candidates int:=0;
  published_media int:=0;
  invalid_count int:=0;
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;
  if jsonb_typeof(coalesce(p_questions,'[]'::jsonb))<>'array' then raise exception 'p_questions must be an array'; end if;

  for item in select value from jsonb_array_elements(coalesce(p_questions,'[]'::jsonb))
  loop
    canonical:=nullif(trim(item->>'canonical_key'),'');
    if canonical is null then invalid_count:=invalid_count+1; continue; end if;

    qtype:=coalesce(nullif(trim(item->>'question_type'),''),'numeric');
    if qtype not in ('numeric','multiple_choice','text') then invalid_count:=invalid_count+1; continue; end if;
    if coalesce(length(trim(item->>'prompt')),0)<4 then invalid_count:=invalid_count+1; continue; end if;
    if coalesce(item->>'difficulty','') not in ('easy','medium','hard') then invalid_count:=invalid_count+1; continue; end if;

    select q.* into before_q from public.questions q where q.canonical_key=canonical for update;

    if before_q.id is null then
      opts:=case when jsonb_typeof(item->'options')='array' then item->'options' else null end;
      insert into public.questions(
        category,difficulty,question_type,prompt,context,unit,options,answer_numeric,answer_text,correct_option,
        explanation,source_url,is_active,source_type,source_entity_id,canonical_key,media_query,updated_at,content_locked
      ) values(
        coalesce(nullif(trim(item->>'category'),''),'General'),item->>'difficulty',qtype,trim(item->>'prompt'),
        nullif(trim(coalesce(item->>'context','')),''),nullif(trim(coalesce(item->>'unit','')),''),
        case when qtype='multiple_choice' then opts else null end,
        case when qtype='numeric' and coalesce(item->>'answer_numeric','') ~ '^-?[0-9]+([.][0-9]+)?$' then (item->>'answer_numeric')::numeric else null end,
        case when qtype='text' then nullif(trim(coalesce(item->>'answer_text','')),'') else null end,
        case when qtype='multiple_choice' and coalesce(item->>'correct_option','') ~ '^[0-9]+$' then (item->>'correct_option')::int else null end,
        nullif(trim(coalesce(item->>'explanation','')),''),nullif(trim(coalesce(item->>'source_url','')),''),true,
        coalesce(nullif(trim(item->>'source_type'),''),'local_content_studio'),
        nullif(trim(coalesce(item->>'source_entity_id','')),''),canonical,
        nullif(trim(coalesce(item->>'media_query','')),''),now(),false
      ) returning * into after_q;

      -- Validate the required answer shape after insert values are normalized.
      if (qtype='numeric' and after_q.answer_numeric is null)
         or (qtype='text' and after_q.answer_text is null)
         or (qtype='multiple_choice' and (after_q.options is null or after_q.correct_option is null)) then
        raise exception 'Invalid answer payload for %',canonical;
      end if;

      qid:=after_q.id;
      created_count:=created_count+1;
      perform public._audit_question_admin(qid,'create',null,to_jsonb(after_q),jsonb_build_object(
        'origin','local_content_studio','package_id',p_package_id,'canonical_key',canonical
      ));
    else
      qid:=before_q.id;
      if not before_q.is_active then
        retired_count:=retired_count+1;
      elsif coalesce(p_preserve_content_locked,true) and before_q.content_locked then
        content_locked_count:=content_locked_count+1;
      else
        opts:=case when jsonb_typeof(item->'options')='array' then item->'options' else null end;
        incoming_core:=jsonb_build_object(
          'category',coalesce(nullif(trim(item->>'category'),''),before_q.category),
          'difficulty',item->>'difficulty','question_type',qtype,'prompt',trim(item->>'prompt'),
          'context',nullif(trim(coalesce(item->>'context','')),''),'unit',nullif(trim(coalesce(item->>'unit','')),''),
          'options',case when qtype='multiple_choice' then opts else null end,
          'answer_numeric',case when qtype='numeric' and coalesce(item->>'answer_numeric','') ~ '^-?[0-9]+([.][0-9]+)?$' then to_jsonb((item->>'answer_numeric')::numeric) else 'null'::jsonb end,
          'answer_text',case when qtype='text' then to_jsonb(nullif(trim(coalesce(item->>'answer_text','')),'')) else 'null'::jsonb end,
          'correct_option',case when qtype='multiple_choice' and coalesce(item->>'correct_option','') ~ '^[0-9]+$' then to_jsonb((item->>'correct_option')::int) else 'null'::jsonb end,
          'explanation',nullif(trim(coalesce(item->>'explanation','')),''),'source_url',nullif(trim(coalesce(item->>'source_url','')),''),
          'source_type',coalesce(nullif(trim(item->>'source_type'),''),before_q.source_type),
          'source_entity_id',coalesce(nullif(trim(item->>'source_entity_id'),''),before_q.source_entity_id),
          'media_query',coalesce(nullif(trim(item->>'media_query'),''),before_q.media_query)
        );
        existing_core:=jsonb_build_object(
          'category',before_q.category,'difficulty',before_q.difficulty,'question_type',before_q.question_type,'prompt',before_q.prompt,
          'context',before_q.context,'unit',before_q.unit,'options',before_q.options,'answer_numeric',before_q.answer_numeric,
          'answer_text',before_q.answer_text,'correct_option',before_q.correct_option,'explanation',before_q.explanation,
          'source_url',before_q.source_url,'source_type',before_q.source_type,'source_entity_id',before_q.source_entity_id,'media_query',before_q.media_query
        );

        if existing_core= incoming_core then
          after_q:=before_q;
          unchanged_count:=unchanged_count+1;
        else
          update public.questions q set
            category=coalesce(nullif(trim(item->>'category'),''),q.category),difficulty=item->>'difficulty',question_type=qtype,prompt=trim(item->>'prompt'),
            context=nullif(trim(coalesce(item->>'context','')),''),unit=nullif(trim(coalesce(item->>'unit','')),''),
            options=case when qtype='multiple_choice' then opts else null end,
            answer_numeric=case when qtype='numeric' and coalesce(item->>'answer_numeric','') ~ '^-?[0-9]+([.][0-9]+)?$' then (item->>'answer_numeric')::numeric else null end,
            answer_text=case when qtype='text' then nullif(trim(coalesce(item->>'answer_text','')),'') else null end,
            correct_option=case when qtype='multiple_choice' and coalesce(item->>'correct_option','') ~ '^[0-9]+$' then (item->>'correct_option')::int else null end,
            explanation=nullif(trim(coalesce(item->>'explanation','')),''),source_url=nullif(trim(coalesce(item->>'source_url','')),''),
            source_type=coalesce(nullif(trim(item->>'source_type'),''),q.source_type),source_entity_id=coalesce(nullif(trim(item->>'source_entity_id'),''),q.source_entity_id),
            media_query=coalesce(nullif(trim(item->>'media_query'),''),q.media_query),updated_at=now()
          where q.id=qid returning * into after_q;
          updated_count:=updated_count+1;
          perform public._audit_question_admin(qid,'edit',to_jsonb(before_q),to_jsonb(after_q),jsonb_build_object(
            'origin','local_content_studio','package_id',p_package_id,'canonical_key',canonical,'automated_sync',true
          ));
        end if;
      end if;
    end if;

    -- Media is imported even if factual content is protected, unless the media itself is locked.
    select q.* into after_q from public.questions q where q.id=qid;
    media:=coalesce(item->'media','{}'::jsonb);
    if after_q.media_locked and coalesce(p_preserve_media_locked,true) then
      media_locked_count:=media_locked_count+1;
      continue;
    end if;

    if nullif(trim(media->>'query'),'') is not null then
      update public.questions q set media_query=left(trim(media->>'query'),500) where q.id=qid;
    elsif nullif(trim(item->>'media_query'),'') is not null then
      update public.questions q set media_query=left(trim(item->>'media_query'),500) where q.id=qid;
    end if;

    if jsonb_typeof(media->'candidates')='array' then
      for cand in select value from jsonb_array_elements(media->'candidates')
      loop
        if nullif(trim(cand->>'provider'),'') is null
           or nullif(trim(cand->>'provider_key'),'') is null
           or nullif(trim(cand->>'image_url'),'') is null then continue; end if;

        insert into public.question_media_candidates(
          question_id,provider,provider_key,title,image_url,thumbnail_url,source_url,creator,creator_url,
          license,license_url,width,height,score,auto_eligible,is_available,status,metadata,updated_at,last_checked_at
        ) values(
          qid,left(trim(cand->>'provider'),60),left(trim(cand->>'provider_key'),240),nullif(left(trim(coalesce(cand->>'title','')),500),''),
          trim(cand->>'image_url'),nullif(trim(coalesce(cand->>'thumbnail_url','')),''),nullif(trim(coalesce(cand->>'source_url','')),''),
          nullif(left(trim(coalesce(cand->>'creator','')),500),''),nullif(trim(coalesce(cand->>'creator_url','')),''),
          nullif(left(trim(coalesce(cand->>'license','')),200),''),nullif(trim(coalesce(cand->>'license_url','')),''),
          case when coalesce(cand->>'width','') ~ '^[0-9]+$' then (cand->>'width')::int else null end,
          case when coalesce(cand->>'height','') ~ '^[0-9]+$' then (cand->>'height')::int else null end,
          case when coalesce(cand->>'score','') ~ '^-?[0-9]+([.][0-9]+)?$' then (cand->>'score')::numeric else 0 end,
          coalesce((cand->>'auto_eligible')::boolean,false),coalesce((cand->>'is_available')::boolean,false),'candidate',
          coalesce(cand->'metadata','{}'::jsonb),now(),now()
        )
        on conflict(question_id,provider,provider_key) do update set
          title=excluded.title,image_url=excluded.image_url,thumbnail_url=excluded.thumbnail_url,source_url=excluded.source_url,
          creator=excluded.creator,creator_url=excluded.creator_url,license=excluded.license,license_url=excluded.license_url,
          width=excluded.width,height=excluded.height,score=excluded.score,auto_eligible=excluded.auto_eligible,
          is_available=excluded.is_available,metadata=excluded.metadata,
          status=case when public.question_media_candidates.status='rejected' then 'rejected' else 'candidate' end,
          updated_at=now(),last_checked_at=now()
        returning id into cid;
        imported_candidates:=imported_candidates+1;
      end loop;
    end if;

    selected_provider:=nullif(trim(media#>>'{selected,provider}'),'');
    selected_key:=nullif(trim(media#>>'{selected,provider_key}'),'');
    selected_manual:=lower(coalesce(media->>'selection_mode','auto'))='manual';

    if selected_provider is not null and selected_key is not null then
      select c.* into selected_candidate from public.question_media_candidates c
      where c.question_id=qid and c.provider=selected_provider and c.provider_key=selected_key
        and c.status<>'rejected' and c.is_available=true limit 1;

      if selected_candidate.id is not null and coalesce(p_auto_publish,true)
         and (selected_candidate.auto_eligible or selected_manual) then
        update public.question_media_candidates c set
          status=case when c.id=selected_candidate.id then 'auto_selected' when c.status in ('selected','auto_selected') then 'candidate' else c.status end,
          updated_at=now()
        where c.question_id=qid and c.status<>'rejected';

        update public.questions q set
          image_url=coalesce(nullif(selected_candidate.thumbnail_url,''),selected_candidate.image_url),
          image_alt=coalesce(nullif(selected_candidate.title,''),q.media_query,q.image_alt,q.prompt),
          image_source_url=selected_candidate.source_url,image_attribution=selected_candidate.creator,
          image_license=selected_candidate.license,image_license_url=selected_candidate.license_url,
          media_provider=selected_candidate.provider,media_candidate_id=selected_candidate.id,
          media_review_status='auto',media_locked=false,media_updated_at=now(),media_last_resolved_at=now()
        where q.id=qid;
        published_media:=published_media+1;
      else
        update public.questions q set media_last_resolved_at=now(),media_updated_at=now() where q.id=qid;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'created',created_count,'updated',updated_count,'unchanged',unchanged_count,
    'content_locked',content_locked_count,'retired',retired_count,'media_locked',media_locked_count,
    'imported_candidates',imported_candidates,'published_media',published_media,'invalid',invalid_count
  );
end $$;

revoke all on function public.admin_create_question_v10(jsonb) from public,anon;
grant execute on function public.admin_create_question_v10(jsonb) to authenticated;
revoke all on function public.admin_update_question_v10(uuid,jsonb) from public,anon;
grant execute on function public.admin_update_question_v10(uuid,jsonb) to authenticated;

revoke all on function public.admin_import_content_package_v12(jsonb,text,boolean,boolean,boolean) from public,anon;
grant execute on function public.admin_import_content_package_v12(jsonb,text,boolean,boolean,boolean) to authenticated;

commit;
