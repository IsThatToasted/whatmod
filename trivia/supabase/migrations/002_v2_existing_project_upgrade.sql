-- WhatMod Trivia V2 - safe upgrade for an existing Supabase project
-- Run this ONCE in SQL Editor after deploying the V2 frontend.

alter table public.profiles
  add column if not exists username_customized boolean not null default false;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare google_name text; google_avatar text;
begin
  google_name := left(coalesce(
    nullif(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'name',''),
    nullif(new.raw_user_meta_data->>'given_name',''),
    nullif(split_part(coalesce(new.email,''),'@',1),''),
    'Player'
  ),24);
  google_avatar := coalesce(nullif(new.raw_user_meta_data->>'avatar_url',''),nullif(new.raw_user_meta_data->>'picture',''));
  insert into public.profiles(user_id,username,username_customized,avatar_url)
  values(new.id,google_name,false,google_avatar)
  on conflict(user_id) do nothing;
  return new;
end $$;

create or replace function public.sync_my_google_profile()
returns public.profiles language plpgsql security definer set search_path=public as $$
declare p public.profiles; u auth.users; google_name text; google_avatar text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into u from auth.users where id=auth.uid();
  if u.id is null then raise exception 'User not found'; end if;
  google_name := left(coalesce(
    nullif(u.raw_user_meta_data->>'full_name',''),
    nullif(u.raw_user_meta_data->>'name',''),
    nullif(u.raw_user_meta_data->>'given_name',''),
    nullif(split_part(coalesce(u.email,''),'@',1),''),
    'Player'
  ),24);
  google_avatar := coalesce(nullif(u.raw_user_meta_data->>'avatar_url',''),nullif(u.raw_user_meta_data->>'picture',''));
  insert into profiles(user_id,username,username_customized,avatar_url)
  values(u.id,google_name,false,google_avatar)
  on conflict(user_id) do update set
    username = case when profiles.username_customized then profiles.username else excluded.username end,
    avatar_url = coalesce(excluded.avatar_url,profiles.avatar_url)
  returning * into p;
  return p;
end $$;

create or replace function public.update_my_profile(p_username text)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare p public.profiles;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  p_username:=trim(p_username);
  if char_length(p_username)<2 or char_length(p_username)>24 then raise exception 'Display name must be 2-24 characters'; end if;
  update profiles set username=p_username,username_customized=true where user_id=auth.uid() returning * into p;
  return p;
end $$;

create or replace function public.daily_question_id(p_day date)
returns uuid language sql stable security definer set search_path=public as $$
  select id from questions where is_active and question_type='numeric'
  order by md5(id::text || ':' || p_day::text) limit 1;
$$;

grant execute on function public.sync_my_google_profile() to authenticated;
grant execute on function public.update_my_profile(text) to authenticated;

-- Infer whether an existing V1 player had already chosen a custom name.
-- If their current trivia name differs from Google's name (and is not the old generic "Player"), preserve it forever.
update public.profiles p
set username_customized = case
  when p.username is null or p.username='' or p.username='Player' then false
  when lower(p.username) <> lower(left(coalesce(
    nullif(u.raw_user_meta_data->>'full_name',''),
    nullif(u.raw_user_meta_data->>'name',''),
    nullif(u.raw_user_meta_data->>'given_name',''),
    nullif(split_part(coalesce(u.email,''),'@',1),''),
    p.username
  ),24)) then true
  else false
end
from auth.users u
where p.user_id=u.id;

-- Backfill only generic V1 names from Google and refresh avatars. Custom names remain untouched.
update public.profiles p
set username = case when p.username_customized then p.username else left(coalesce(
      nullif(u.raw_user_meta_data->>'full_name',''),
      nullif(u.raw_user_meta_data->>'name',''),
      nullif(u.raw_user_meta_data->>'given_name',''),
      nullif(split_part(coalesce(u.email,''),'@',1),''),
      p.username
    ),24) end,
    avatar_url = coalesce(nullif(u.raw_user_meta_data->>'avatar_url',''),nullif(u.raw_user_meta_data->>'picture',''),p.avatar_url)
from auth.users u
where p.user_id=u.id;
