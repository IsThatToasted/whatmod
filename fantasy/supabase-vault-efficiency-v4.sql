-- Afterglow v4 — Vault + efficiency migration
-- Safe to run after the v2.1 hardening migration and v3 distribution migration.
-- This migration does not rewrite existing profile, Vault, wallet, premium, or media data.

begin;

-- Realtime messages replace aggressive browser polling. Add the messages table
-- to Supabase Realtime exactly once. RLS remains authoritative.
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname='supabase_realtime' and schemaname='public' and tablename='fv_messages'
     ) then
    alter publication supabase_realtime add table public.fv_messages;
  end if;
end $$;

-- Useful for targeted inbox/realtime fallback reads.
create index if not exists fv_messages_recipient_created_idx
  on public.fv_messages(recipient_id, created_at desc);

-- Owner-only usage diagnostics. Storage byte totals are read from Storage object
-- metadata; no objects are modified or deleted by this function.
create or replace function public.fv_admin_usage_summary()
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_storage jsonb := '{}'::jsonb;
  v_orphans jsonb := '{}'::jsonb;
  v_result jsonb;
begin
  if auth.uid() is null or not public.fv_is_admin() then
    raise exception 'Admin access required';
  end if;

  select coalesce(jsonb_object_agg(bucket_id, jsonb_build_object('objects', object_count, 'bytes', object_bytes)), '{}'::jsonb)
    into v_storage
  from (
    select bucket_id,
           count(*)::bigint as object_count,
           coalesce(sum(
             case
               when coalesce(metadata->>'size','') ~ '^[0-9]+$' then (metadata->>'size')::bigint
               else 0
             end
           ),0)::bigint as object_bytes
    from storage.objects
    group by bucket_id
  ) s;

  -- Diagnostic only: objects that do not have a corresponding live metadata
  -- reference. We report these candidates but do not delete them from SQL;
  -- object deletion must remain a Storage API operation.
  select coalesce(jsonb_object_agg(bucket_id, jsonb_build_object('objects', object_count, 'bytes', object_bytes)), '{}'::jsonb)
    into v_orphans
  from (
    select o.bucket_id,
           count(*)::bigint as object_count,
           coalesce(sum(case when coalesce(o.metadata->>'size','') ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else 0 end),0)::bigint as object_bytes
    from storage.objects o
    where o.bucket_id='fv-private-albums'
      and not exists (select 1 from public.fv_private_album_photos p where p.path=o.name)
    group by o.bucket_id

    union all

    select o.bucket_id,
           count(*)::bigint,
           coalesce(sum(case when coalesce(o.metadata->>'size','') ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else 0 end),0)::bigint
    from storage.objects o
    where o.bucket_id='fv-private-chat'
      and not exists (
        select 1
        from public.fv_messages m
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(coalesce(m.media,'[]'::jsonb))='array' then m.media else '[]'::jsonb end
        ) item
        where item->>'path'=o.name
      )
    group by o.bucket_id

    union all

    select o.bucket_id,
           count(*)::bigint,
           coalesce(sum(case when coalesce(o.metadata->>'size','') ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else 0 end),0)::bigint
    from storage.objects o
    where o.bucket_id='fv-profile-photos'
      and not exists (
        select 1 from public.fv_profiles p
        where coalesce(p.profile->>'avatarUrl','') like '%' || o.name
      )
    group by o.bucket_id
  ) orphan_rows
  where object_count>0;

  v_result := jsonb_build_object(
    'database_bytes', pg_database_size(current_database()),
    'table_bytes', jsonb_build_object(
      'profiles', coalesce(pg_total_relation_size(to_regclass('public.fv_profiles')),0),
      'revisions', coalesce(pg_total_relation_size(to_regclass('public.fv_profile_revisions')),0),
      'messages', coalesce(pg_total_relation_size(to_regclass('public.fv_messages')),0),
      'activity', coalesce(pg_total_relation_size(to_regclass('public.fv_activity_events')),0),
      'wallet_ledger', coalesce(pg_total_relation_size(to_regclass('public.fv_wallet_ledger')),0),
      'private_album_metadata', coalesce(pg_total_relation_size(to_regclass('public.fv_private_album_photos')),0)
    ),
    'row_counts', jsonb_build_object(
      'profiles', (select count(*) from public.fv_profiles),
      'revisions', (select count(*) from public.fv_profile_revisions),
      'messages', (select count(*) from public.fv_messages),
      'activity', (select count(*) from public.fv_activity_events),
      'wallet_ledger', (select count(*) from public.fv_wallet_ledger),
      'private_album_photos', (select count(*) from public.fv_private_album_photos)
    ),
    'storage_buckets', v_storage,
    'orphan_candidates', v_orphans,
    'legacy_embedded_images', jsonb_build_object(
      'profile_rows', (select count(*) from public.fv_profiles where coalesce(profile->>'avatarUrl','') like 'data:image/%'),
      'profile_bytes', coalesce((select sum(octet_length(profile->>'avatarUrl')) from public.fv_profiles where coalesce(profile->>'avatarUrl','') like 'data:image/%'),0),
      'revision_rows', (select count(*) from public.fv_profile_revisions where coalesce(profile->>'avatarUrl','') like 'data:image/%'),
      'revision_bytes', coalesce((select sum(octet_length(profile->>'avatarUrl')) from public.fv_profile_revisions where coalesce(profile->>'avatarUrl','') like 'data:image/%'),0)
    ),
    'measured_at', now()
  );

  return v_result;
end;
$$;

revoke all on function public.fv_admin_usage_summary() from public, anon;
grant execute on function public.fv_admin_usage_summary() to authenticated;

-- If an older browser ever persisted a base64 avatar inside profile JSON, the
-- v4 client first migrates that image into fv-profile-photos. Only after a real
-- HTTPS Storage URL exists do we replace embedded copies in that user's old
-- recovery revisions, retaining the durable current avatar in every revision.
create or replace function public.fv_scrub_my_legacy_avatar_revisions()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_avatar text;
  v_count bigint := 0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select profile->>'avatarUrl' into v_avatar
  from public.fv_profiles
  where user_id=v_uid;

  if v_avatar is null or v_avatar !~* '^https://'
     or position('/storage/v1/object/' in v_avatar)=0 then
    return 0;
  end if;

  update public.fv_profile_revisions
  set profile=jsonb_set(coalesce(profile,'{}'::jsonb),'{avatarUrl}',to_jsonb(v_avatar),true)
  where user_id=v_uid
    and coalesce(profile->>'avatarUrl','') like 'data:image/%';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.fv_scrub_my_legacy_avatar_revisions() from public, anon;
grant execute on function public.fv_scrub_my_legacy_avatar_revisions() to authenticated;

commit;
