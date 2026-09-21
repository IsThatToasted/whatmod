-- WhatMod Trivia V5 - Realtime lobby roster sync
-- Fixes silent Supabase Realtime roster updates caused by recursive RLS policy checks.
-- Safe to run on an existing V4 project. Does not delete or reset game/user data.

-- Realtime Postgres Changes evaluates SELECT RLS for the subscribing user.
-- The original game_players SELECT policy queried game_players from inside its own
-- policy, which can recurse during Realtime authorization and silently suppress events.
-- Use a SECURITY DEFINER membership helper so policy checks do not recurse.
create or replace function public.is_game_participant(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null
     and (
       exists (
         select 1
         from public.games g
         where g.id = p_game_id
           and g.host_id = (select auth.uid())
       )
       or exists (
         select 1
         from public.game_players gp
         where gp.game_id = p_game_id
           and gp.user_id = (select auth.uid())
       )
     );
$$;

revoke all on function public.is_game_participant(uuid) from public, anon;
grant execute on function public.is_game_participant(uuid) to authenticated;

-- Replace recursive policies with non-recursive membership checks.
drop policy if exists "games participant read" on public.games;
create policy "games participant read"
on public.games
for select
to authenticated
using (public.is_game_participant(id));

drop policy if exists "players participant read" on public.game_players;
create policy "players participant read"
on public.game_players
for select
to authenticated
using (public.is_game_participant(game_id));

-- The browser only needs SELECT on these tables; writes continue through RPCs.
revoke insert, update, delete on table public.games from anon, authenticated;
revoke insert, update, delete on table public.game_players from anon, authenticated;
grant select on table public.games, public.game_players to authenticated;

-- Ensure both tables are actually included in Supabase's Postgres Changes publication.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_players'
  ) then
    alter publication supabase_realtime add table public.game_players;
  end if;
end $$;

-- FULL identity lets DELETE/UPDATE events retain the game_id filter column as the
-- project later gains leave/kick/reconnect behavior.
alter table public.games replica identity full;
alter table public.game_players replica identity full;

-- Helpful index for membership checks used by Realtime RLS.
create index if not exists game_players_user_game_idx
  on public.game_players(user_id, game_id);
