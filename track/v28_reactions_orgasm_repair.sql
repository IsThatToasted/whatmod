

-- ============================================================
-- WeTrack V2.8 — reliable reactions + shared orgasm counter
-- Safe to run repeatedly.
-- ============================================================

grant select, insert, update, delete on public.itinerary_fun_bucket_reactions to authenticated;
alter table public.itinerary_fun_bucket_reactions replica identity full;

drop policy if exists "bucket reactions visible to participants" on public.itinerary_fun_bucket_reactions;
create policy "bucket reactions visible to participants" on public.itinerary_fun_bucket_reactions
for select to authenticated using (public.user_can_access_fun_space(space_id));

drop policy if exists "users manage own bucket reactions" on public.itinerary_fun_bucket_reactions;
create policy "users manage own bucket reactions" on public.itinerary_fun_bucket_reactions
for all to authenticated
using (user_id = auth.uid() and public.user_can_access_fun_space(space_id))
with check (user_id = auth.uid() and public.user_can_access_fun_space(space_id));

create or replace function public.upsert_itinerary_fun_bucket_reaction(p_space_id uuid,p_fun_idea_id uuid,p_score int)
returns public.itinerary_fun_bucket_reactions
language plpgsql security definer set search_path=public as $$
declare v_row public.itinerary_fun_bucket_reactions;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.user_can_access_fun_space(p_space_id) then raise exception 'Fun Ideas access denied'; end if;
  if not exists(select 1 from public.itinerary_fun_bucket_ideas where id=p_fun_idea_id and space_id=p_space_id) then raise exception 'Idea is not in this shared bucket'; end if;
  insert into public.itinerary_fun_bucket_reactions(space_id,fun_idea_id,user_id,score,updated_at)
  values(p_space_id,p_fun_idea_id,auth.uid(),greatest(0,least(100,p_score)),now())
  on conflict(fun_idea_id,user_id) do update set space_id=excluded.space_id,score=excluded.score,updated_at=excluded.updated_at
  returning * into v_row;
  return v_row;
end $$;
grant execute on function public.upsert_itinerary_fun_bucket_reaction(uuid,uuid,int) to authenticated;

create table if not exists public.itinerary_fun_orgasm_events(
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.itinerary_fun_spaces(id) on delete cascade,
  experienced_by uuid not null references auth.users(id) on delete cascade,
  caused_by uuid not null references auth.users(id) on delete cascade,
  pleasure_level int not null check(pleasure_level between 1 and 10),
  role text not null default 'neutral' check(role in ('submissive','dominant','neutral')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_fun_orgasm_space_time on public.itinerary_fun_orgasm_events(space_id,occurred_at desc);
create index if not exists idx_fun_orgasm_experienced on public.itinerary_fun_orgasm_events(experienced_by);
alter table public.itinerary_fun_orgasm_events enable row level security;
alter table public.itinerary_fun_orgasm_events replica identity full;
grant select,insert,delete on public.itinerary_fun_orgasm_events to authenticated;
drop policy if exists "orgasm events visible to bucket participants" on public.itinerary_fun_orgasm_events;
create policy "orgasm events visible to bucket participants" on public.itinerary_fun_orgasm_events for select to authenticated using(public.user_can_access_fun_space(space_id));
drop policy if exists "users add own orgasm events" on public.itinerary_fun_orgasm_events;
create policy "users add own orgasm events" on public.itinerary_fun_orgasm_events for insert to authenticated with check(experienced_by=auth.uid() and public.user_can_access_fun_space(space_id));
drop policy if exists "users delete own orgasm events" on public.itinerary_fun_orgasm_events;
create policy "users delete own orgasm events" on public.itinerary_fun_orgasm_events for delete to authenticated using(experienced_by=auth.uid() and public.user_can_access_fun_space(space_id));

do $$ begin
  begin alter publication supabase_realtime add table public.itinerary_fun_bucket_reactions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.itinerary_fun_orgasm_events; exception when duplicate_object then null; end;
end $$;
notify pgrst,'reload schema';
