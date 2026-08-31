-- Aurelium Field v0.9.2
-- Stable mobile workspace bootstrap API. Safe to run repeatedly.

create or replace function public.get_my_workspace()
returns table(
  organization_id uuid,
  user_id uuid,
  role public.member_role,
  display_name text,
  active boolean,
  organization_name text,
  organization_slug text
)
language sql
stable
security definer
set search_path=public
as $$
  select
    m.organization_id,
    m.user_id,
    m.role,
    m.display_name,
    m.active,
    o.name as organization_name,
    o.slug as organization_slug
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid()
    and m.active = true
  order by m.created_at asc
  limit 1;
$$;

revoke all on function public.get_my_workspace() from public;
grant execute on function public.get_my_workspace() to authenticated;
