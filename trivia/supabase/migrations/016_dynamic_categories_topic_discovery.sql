-- Trivia V16 — dynamic category discovery
-- Safe to run repeatedly. Categories are derived from active questions so custom
-- categories imported from the Local Content Studio automatically appear in
-- Practice and custom-lobby selectors without another frontend release.

create or replace function public.get_available_categories_v16()
returns table(category text, question_count bigint)
language sql
security definer
set search_path=public
as $$
  select q.category::text, count(*)::bigint
  from public.questions q
  where q.is_active=true
    and nullif(trim(q.category),'') is not null
  group by q.category
  order by count(*) desc, q.category asc;
$$;

revoke all on function public.get_available_categories_v16() from public;
grant execute on function public.get_available_categories_v16() to anon,authenticated;

select jsonb_build_object(
  'rpc_exists', to_regprocedure('public.get_available_categories_v16()') is not null,
  'status', case when to_regprocedure('public.get_available_categories_v16()') is not null then 'READY' else 'MISSING' end
) as v16_category_status;
