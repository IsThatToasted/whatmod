-- ============================================================
-- WeTrack V2.5 — persistent Fun Ideas reaction RPC
-- One authoritative write path for the cross-trip bucket list.
-- Safe to run repeatedly.
-- ============================================================
create or replace function public.upsert_itinerary_fun_bucket_reaction(
  p_space_id uuid,
  p_fun_idea_id uuid,
  p_score int
)
returns public.itinerary_fun_bucket_reactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.itinerary_fun_bucket_reactions;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_space_id is null or p_fun_idea_id is null then
    raise exception 'Fun Ideas space and idea are required';
  end if;
  if p_score is null or p_score < 0 or p_score > 100 then
    raise exception 'Reaction score must be between 0 and 100';
  end if;
  if not public.user_can_access_fun_space(p_space_id) then
    raise exception 'Fun Ideas access denied';
  end if;
  if not exists (
    select 1
    from public.itinerary_fun_bucket_ideas i
    where i.id = p_fun_idea_id
      and i.space_id = p_space_id
  ) then
    raise exception 'Fun Idea does not belong to the active shared bucket';
  end if;

  insert into public.itinerary_fun_bucket_reactions(
    space_id, fun_idea_id, user_id, score, updated_at
  ) values (
    p_space_id, p_fun_idea_id, auth.uid(), p_score, now()
  )
  on conflict (fun_idea_id, user_id)
  do update set
    space_id = excluded.space_id,
    score = excluded.score,
    updated_at = excluded.updated_at
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.upsert_itinerary_fun_bucket_reaction(uuid, uuid, int) to authenticated;
