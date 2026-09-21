-- Trivia V8: release UI theme preference.
-- Safe for existing projects; no gameplay/progression data is modified.

alter table public.profiles
  add column if not exists ui_theme text not null default 'v2';

alter table public.profiles
  drop constraint if exists profiles_ui_theme_check;

alter table public.profiles
  add constraint profiles_ui_theme_check check (ui_theme in ('v1','v2'));

update public.profiles
set ui_theme='v2'
where ui_theme is null or ui_theme not in ('v1','v2');

create or replace function public.update_my_ui_theme(p_theme text)
returns public.profiles
language plpgsql
security definer
set search_path=public
as $$
declare p public.profiles;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  p_theme:=lower(trim(coalesce(p_theme,'')));
  if p_theme not in ('v1','v2') then raise exception 'Theme must be v1 or v2'; end if;
  update public.profiles
     set ui_theme=p_theme
   where user_id=auth.uid()
   returning * into p;
  if p.user_id is null then raise exception 'Profile not found'; end if;
  return p;
end $$;

revoke execute on function public.update_my_ui_theme(text) from public,anon;
grant execute on function public.update_my_ui_theme(text) to authenticated;
