-- Trivia V19 — Category Command Center + Local Category Refill Pipeline
-- Adds an admin-only population summary used by Trivia Admin to balance the bank.
-- Safe to run repeatedly.

create or replace function public.admin_category_population_v19()
returns table(
  category text,
  total_count bigint,
  active_count bigint,
  easy_count bigint,
  medium_count bigint,
  hard_count bigint,
  valid_photo_count bigint,
  missing_photo_count bigint,
  retired_count bigint,
  upvotes bigint,
  downvotes bigint
)
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;

  return query
  with vote_totals as (
    select v.question_id,
      count(*) filter(where v.vote=1)::bigint as upvotes,
      count(*) filter(where v.vote=-1)::bigint as downvotes
    from public.question_votes v
    group by v.question_id
  ), question_rows as (
    select q.id,q.category,q.is_active,q.difficulty,
      public.question_has_valid_photo_v15(q.id) as has_valid_photo,
      coalesce(v.upvotes,0)::bigint as upvotes,
      coalesce(v.downvotes,0)::bigint as downvotes
    from public.questions q
    left join vote_totals v on v.question_id=q.id
    where nullif(trim(q.category),'') is not null
  )
  select
    qr.category::text,
    count(*)::bigint,
    count(*) filter(where qr.is_active)::bigint,
    count(*) filter(where qr.is_active and qr.difficulty='easy')::bigint,
    count(*) filter(where qr.is_active and qr.difficulty='medium')::bigint,
    count(*) filter(where qr.is_active and qr.difficulty='hard')::bigint,
    count(*) filter(where qr.is_active and qr.has_valid_photo)::bigint,
    count(*) filter(where qr.is_active and not qr.has_valid_photo)::bigint,
    count(*) filter(where not qr.is_active)::bigint,
    sum(qr.upvotes)::bigint,
    sum(qr.downvotes)::bigint
  from question_rows qr
  group by qr.category
  order by count(*) filter(where qr.is_active) desc,qr.category;
end $$;

revoke all on function public.admin_category_population_v19() from public,anon;
grant execute on function public.admin_category_population_v19() to authenticated;

select jsonb_build_object(
  'rpc_exists',to_regprocedure('public.admin_category_population_v19()') is not null,
  'status',case when to_regprocedure('public.admin_category_population_v19()') is not null then 'READY' else 'MISSING' end
) as v19_category_command_status;
