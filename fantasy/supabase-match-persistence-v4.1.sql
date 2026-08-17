-- Afterglow v4.1 — persistent matches / long-distance connection fix
-- Safe to run repeatedly after the v4 schema/migrations.
--
-- Established mutual matches and incoming likes are relationship data, not
-- discovery data. They must remain visible regardless of distance, premium
-- status, profile recency, or whether the other member is currently online.

begin;

create or replace function public.fv_get_directory(p_limit integer default 80)
returns table(
  id uuid,
  user_id uuid,
  email text,
  profile jsonb,
  ratings jsonb,
  liked jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      coalesce(p.ratings,'{}'::jsonb) as ratings,
      coalesce(p.liked,'[]'::jsonb) as liked,
      public.fv_json_number(p.profile #>> '{location,lat}') as lat,
      public.fv_json_number(p.profile #>> '{location,lng}') as lng,
      coalesce(viewer_pe.premium_until > now(),false) as premium_active
    from (select auth.uid() as uid) a
    left join public.fv_profiles p on p.user_id=a.uid
    left join public.fv_premium_entitlements viewer_pe on viewer_pe.user_id=a.uid
  ), candidates as (
    select
      p.*,
      me.ratings as viewer_ratings,
      me.lat as viewer_lat,
      me.lng as viewer_lng,
      me.premium_active,
      public.fv_json_number(p.profile #>> '{location,lat}') as candidate_lat,
      public.fv_json_number(p.profile #>> '{location,lng}') as candidate_lng,
      (coalesce(me.liked,'[]'::jsonb) ? p.user_id::text) as i_like,
      (coalesce(p.liked,'[]'::jsonb) ? auth.uid()::text) as likes_me
    from public.fv_profiles p
    cross join me
    where auth.uid() is not null
      and p.user_id <> auth.uid()
  ), scored as (
    select
      c.*,
      (c.i_like and c.likes_me) as mutual,
      case
        when c.viewer_lat between -90 and 90 and c.viewer_lng between -180 and 180
         and c.candidate_lat between -90 and 90 and c.candidate_lng between -180 and 180
        then 3958.7613 * 2 * asin(least(1.0,sqrt(
          power(sin(radians(c.candidate_lat-c.viewer_lat)/2),2)
          + cos(radians(c.viewer_lat))*cos(radians(c.candidate_lat))*power(sin(radians(c.candidate_lng-c.viewer_lng)/2),2)
        )))
        else null
      end as miles
    from candidates c
  ), selected as (
    -- Connections are never subject to the discovery result limit. This is what
    -- keeps a long-distance/offline match durable even when there are many nearby
    -- profiles in the user's Explorer.
    select s.*
    from scored s
    where s.mutual or s.likes_me

    union all

    select d.*
    from (
      select s.*
      from scored s
      where not s.mutual and not s.likes_me
      order by s.miles nulls last, s.updated_at desc
      limit least(greatest(coalesce(p_limit,80),1),250)
    ) d
  )
  select
    s.id,
    s.user_id,
    case
      when (not s.premium_active)
       and (not s.mutual)
       and (not s.likes_me)
       and (s.miles is null or s.miles > 50)
      then null
      when s.email is null then null
      else 'verified'
    end as email,
    case
      when (not s.premium_active)
       and (not s.mutual)
       and (not s.likes_me)
       and (s.miles is null or s.miles > 50)
      then jsonb_build_object(
        'distanceMiles',case when s.miles is null then null else round(s.miles::numeric,0)::integer end,
        'premiumLocked',true,
        'relationship',jsonb_build_object(
          'iLike',s.i_like,
          'likesMe',s.likes_me,
          'mutual',s.mutual
        )
      )
      else
        (
          coalesce(s.profile,'{}'::jsonb)
            - 'rewards' - 'weeklyGoals' - 'inventory'
            - 'location' - 'locationPromptedAt' - 'locationConsentState'
        ) || jsonb_build_object(
          'inventory',jsonb_build_object(
            'equipped',coalesce((
              select jsonb_object_agg(shop.item_type,shop.item_value)
              from public.fv_user_inventory ui
              join public.fv_shop_items shop on shop.item_id=ui.item_id
              where ui.user_id=s.user_id and ui.equipped=true and shop.active=true
            ),'{}'::jsonb)
          ),
          'distanceMiles',case when s.miles is null then null else round(s.miles::numeric,0)::integer end,
          'premiumActive',coalesce(pe.premium_until > now(),false),
          'premiumLocked',false,
          'relationship',jsonb_build_object(
            'iLike',s.i_like,
            'likesMe',s.likes_me,
            'mutual',s.mutual
          )
        )
    end as profile,
    case
      when (not s.premium_active)
       and (not s.mutual)
       and (not s.likes_me)
       and (s.miles is null or s.miles > 50)
      then '{}'::jsonb
      else coalesce((
        select jsonb_object_agg(e.key,e.value)
        from jsonb_each(coalesce(s.ratings,'{}'::jsonb)) e
        where s.viewer_ratings ? e.key
      ),'{}'::jsonb)
    end as ratings,
    case
      when s.likes_me then jsonb_build_array(auth.uid()::text)
      else '[]'::jsonb
    end as liked,
    s.updated_at
  from selected s
  left join public.fv_premium_entitlements pe on pe.user_id=s.user_id
  order by
    case when s.mutual then 0 when s.likes_me then 1 else 2 end,
    s.miles nulls last,
    s.updated_at desc;
$$;

grant execute on function public.fv_get_directory(integer) to authenticated;
revoke all on function public.fv_get_directory(integer) from public, anon;

commit;
