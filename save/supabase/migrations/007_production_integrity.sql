-- Save 007: production integrity + commitment visibility repair
-- Safe incremental migration for an existing Save database.
-- Do NOT rerun schema.sql. Run this migration after 006.

-- A commitment's lifecycle and Auto Commit state are separate concepts.
-- Earlier versions incorrectly wrote status='paused' whenever Auto Commit was off,
-- which made otherwise-valid commitments disappear from the UI.
update public.commitments
set status='active', updated_at=now()
where status='paused';

create or replace function public.set_my_commitment(
  p_fund_id uuid,
  p_amount_cents bigint,
  p_strength text,
  p_auto_build_cents bigint default 0,
  p_auto_build_cadence text default null
) returns void language plpgsql security definer set search_path=public as $$
declare v_old bigint := 0; v_event text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_fund_member(p_fund_id,auth.uid()) then raise exception 'Not a member'; end if;
  if p_amount_cents < 0 or p_auto_build_cents < 0 then raise exception 'Amounts cannot be negative'; end if;
  if p_strength not in ('firm','flexible','tentative') then raise exception 'Invalid commitment strength'; end if;
  if p_auto_build_cadence is not null and p_auto_build_cadence not in ('weekly','biweekly','monthly') then raise exception 'Invalid cadence'; end if;
  if p_auto_build_cents > 0 and p_auto_build_cadence is null then raise exception 'Choose an Auto Commit cadence'; end if;

  select amount_cents into v_old
  from public.commitments
  where fund_id=p_fund_id and user_id=auth.uid()
  for update;
  v_old := coalesce(v_old,0);

  if p_amount_cents > v_old then v_event := 'increased';
  elsif p_amount_cents < v_old then v_event := 'decreased';
  else v_event := 'strength_changed'; end if;

  insert into public.commitments(
    fund_id,user_id,amount_cents,strength,auto_build_cents,auto_build_cadence,next_build_on,status,updated_at
  ) values(
    p_fund_id,auth.uid(),p_amount_cents,p_strength,p_auto_build_cents,p_auto_build_cadence,
    case when p_auto_build_cents>0 and p_auto_build_cadence is not null then
      case p_auto_build_cadence
        when 'weekly' then current_date+7
        when 'biweekly' then current_date+14
        when 'monthly' then (current_date+interval '1 month')::date
      end
    else null end,
    'active',now()
  )
  on conflict(fund_id,user_id) do update set
    amount_cents=excluded.amount_cents,
    strength=excluded.strength,
    auto_build_cents=excluded.auto_build_cents,
    auto_build_cadence=excluded.auto_build_cadence,
    next_build_on=excluded.next_build_on,
    status='active',
    updated_at=now();

  update public.fund_members
  set share_cents=p_amount_cents,spend_limit_cents=p_amount_cents
  where fund_id=p_fund_id and user_id=auth.uid();

  insert into public.commitment_events(
    fund_id,user_id,event_type,amount_delta_cents,resulting_amount_cents,metadata
  ) values(
    p_fund_id,auth.uid(),v_event,p_amount_cents-v_old,p_amount_cents,
    jsonb_build_object(
      'strength',p_strength,
      'auto_commit_enabled',(p_auto_build_cents>0 and p_auto_build_cadence is not null),
      'auto_build_cents',p_auto_build_cents,
      'auto_build_cadence',p_auto_build_cadence
    )
  );
end $$;
grant execute on function public.set_my_commitment(uuid,bigint,text,bigint,text) to authenticated;

-- Auto Commit now keys off explicit schedule fields. The commitment itself remains active
-- whether or not scheduled growth is enabled.
create or replace function public.process_due_auto_commits()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; v_next date; v_count integer := 0; v_new bigint;
begin
  for r in
    select * from public.commitments
    where status <> 'cancelled'
      and auto_build_cents>0
      and auto_build_cadence is not null
      and next_build_on is not null
      and next_build_on<=current_date
    for update skip locked
  loop
    v_new := r.amount_cents + r.auto_build_cents;
    v_next := case r.auto_build_cadence
      when 'weekly' then r.next_build_on + 7
      when 'biweekly' then r.next_build_on + 14
      when 'monthly' then (r.next_build_on + interval '1 month')::date
      else null end;
    update public.commitments
      set amount_cents=v_new,next_build_on=v_next,status='active',updated_at=now()
      where id=r.id;
    update public.fund_members
      set share_cents=v_new,spend_limit_cents=v_new
      where fund_id=r.fund_id and user_id=r.user_id;
    insert into public.commitment_events(
      fund_id,user_id,event_type,amount_delta_cents,resulting_amount_cents,metadata
    ) values(
      r.fund_id,r.user_id,'auto_build',r.auto_build_cents,v_new,
      jsonb_build_object('cadence',r.auto_build_cadence)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.process_due_auto_commits() from public, anon, authenticated;
grant execute on function public.process_due_auto_commits() to service_role;

-- Production-safe reimbursement creation. If an expense was intentionally left
-- unassigned during planning, choosing to mark it paid splits the actual expense
-- equally across the active group so it can never create an empty reimbursement request.
create or replace function public.mark_plan_paid(
  p_plan_id uuid,p_actual_cents bigint,p_paid_by uuid
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_plan public.planned_expenses;
  v_call uuid;
  v_total_alloc bigint;
  r record;
  v_share bigint;
  v_count int;
  v_running bigint := 0;
  v_i int := 0;
  v_base bigint;
  v_remainder bigint;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_plan from public.planned_expenses where id=p_plan_id for update;
  if v_plan.id is null or not public.is_fund_member(v_plan.fund_id,auth.uid()) then raise exception 'Expense not found'; end if;
  if p_actual_cents <= 0 then raise exception 'Actual amount must be positive'; end if;
  if not public.is_fund_member(v_plan.fund_id,p_paid_by) then raise exception 'Payer must be a member'; end if;
  if v_plan.status='paid' then raise exception 'Expense is already paid'; end if;

  select count(*) into v_count from public.plan_allocations where plan_id=p_plan_id;
  if v_count=0 then
    select count(*) into v_count from public.fund_members where fund_id=v_plan.fund_id and status='active';
    if v_count=0 then raise exception 'This goal has no active members'; end if;
    v_base := v_plan.budget_cents / v_count;
    v_remainder := v_plan.budget_cents % v_count;
    v_i := 0;
    for r in select user_id from public.fund_members where fund_id=v_plan.fund_id and status='active' order by joined_at,user_id loop
      v_i := v_i + 1;
      insert into public.plan_allocations(plan_id,fund_id,user_id,amount_cents)
      values(p_plan_id,v_plan.fund_id,r.user_id,v_base + case when v_i<=v_remainder then 1 else 0 end)
      on conflict(plan_id,user_id) do nothing;
    end loop;
    update public.planned_expenses
      set allocation_mode='split_equal',claimed_by=null,updated_at=now()
      where id=p_plan_id;
  end if;

  update public.planned_expenses
    set actual_cents=p_actual_cents,paid_by=p_paid_by,status='paid',updated_at=now()
    where id=p_plan_id;

  insert into public.funding_calls(fund_id,plan_id,created_by,title,total_cents,due_date,status)
  values(v_plan.fund_id,p_plan_id,auth.uid(),v_plan.title,p_actual_cents,current_date+7,'open')
  returning id into v_call;

  select count(*),coalesce(sum(amount_cents),0)
    into v_count,v_total_alloc
    from public.plan_allocations where plan_id=p_plan_id;
  if v_count=0 or v_total_alloc<=0 then raise exception 'Expense allocation could not be created'; end if;

  v_i := 0;
  for r in
    select user_id,amount_cents,row_number() over(order by created_at,id) rn
    from public.plan_allocations where plan_id=p_plan_id order by created_at,id
  loop
    v_i := v_i + 1;
    if v_i=v_count then v_share:=p_actual_cents-v_running;
    else v_share:=round((p_actual_cents::numeric*r.amount_cents::numeric)/v_total_alloc)::bigint; end if;
    v_running := v_running+v_share;

    insert into public.funding_call_shares(call_id,fund_id,user_id,amount_cents,status,paid_by)
    values(v_call,v_plan.fund_id,r.user_id,v_share,
      case when r.user_id=p_paid_by then 'covered' else 'pending' end,p_paid_by);

    if r.user_id<>p_paid_by and v_share>0 then
      insert into public.settlements(fund_id,call_id,from_user,to_user,amount_cents,status)
      values(v_plan.fund_id,v_call,r.user_id,p_paid_by,v_share,'pending');
    end if;
  end loop;

  if not exists(select 1 from public.funding_call_shares where call_id=v_call and status<>'covered') then
    update public.funding_calls set status='completed',completed_at=now() where id=v_call;
  end if;
  return v_call;
end $$;
grant execute on function public.mark_plan_paid(uuid,bigint,uuid) to authenticated;

-- "Sent" is not the same thing as "received". Keep the reimbursement open until
-- the recipient confirms each external payment.
create or replace function public.mark_my_call_share_paid(
  p_share_id uuid,p_method text default null,p_note text default null
) returns void language plpgsql security definer set search_path=public as $$
declare v_share public.funding_call_shares;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_share from public.funding_call_shares where id=p_share_id for update;
  if v_share.id is null or v_share.user_id<>auth.uid() then raise exception 'Share not found'; end if;
  if v_share.status='covered' then return; end if;
  if v_share.status not in ('pending','declined','paid') then raise exception 'This reimbursement cannot be marked sent'; end if;

  update public.funding_call_shares
    set status='paid',note=nullif(trim(coalesce(p_note,'')),''),updated_at=now()
    where id=p_share_id;
  update public.settlements
    set status='sent',method=nullif(trim(coalesce(p_method,'')),''),note=nullif(trim(coalesce(p_note,'')),'' )
    where call_id=v_share.call_id and from_user=auth.uid() and status in ('pending','sent');
end $$;
grant execute on function public.mark_my_call_share_paid(uuid,text,text) to authenticated;

create or replace function public.confirm_settlement(p_settlement_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare s public.settlements;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into s from public.settlements where id=p_settlement_id for update;
  if s.id is null or s.to_user<>auth.uid() then raise exception 'Settlement not found'; end if;
  if s.status='confirmed' then return; end if;
  if s.status<>'sent' then raise exception 'The payer has not marked this reimbursement as sent yet'; end if;

  update public.settlements
    set status='confirmed',confirmed_at=now()
    where id=p_settlement_id;
  update public.funding_call_shares
    set status='covered',updated_at=now()
    where call_id=s.call_id and user_id=s.from_user and status='paid';

  if s.call_id is not null and not exists(
    select 1 from public.funding_call_shares where call_id=s.call_id and status<>'covered'
  ) then
    update public.funding_calls
      set status='completed',completed_at=coalesce(completed_at,now())
      where id=s.call_id;
  end if;
end $$;
grant execute on function public.confirm_settlement(uuid) to authenticated;

-- Keep the "I'll cover it" invariant when a claimed expense is edited upward.
create or replace function public.update_plan_simple(
  p_plan_id uuid,
  p_title text,
  p_category text,
  p_budget_cents bigint,
  p_due_date date,
  p_notes text default null
) returns void language plpgsql security definer set search_path=public as $$
declare
  v_plan public.planned_expenses;
  v_old_budget bigint;
  v_needed bigint := 0;
  v_current bigint := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_plan from public.planned_expenses where id=p_plan_id for update;
  if v_plan.id is null or not public.is_fund_member(v_plan.fund_id,auth.uid()) then raise exception 'Expense not found'; end if;
  if v_plan.status='paid' then raise exception 'Paid expenses cannot be edited'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 1 and 120 then raise exception 'Expense name is required'; end if;
  if p_budget_cents <= 0 then raise exception 'Expense amount must be positive'; end if;

  v_old_budget := v_plan.budget_cents;
  update public.planned_expenses
    set title=trim(p_title),category=coalesce(nullif(trim(p_category),''),'Other'),budget_cents=p_budget_cents,
        due_date=p_due_date,notes=nullif(trim(coalesce(p_notes,'')),''),updated_at=now()
    where id=p_plan_id;

  if v_plan.allocation_mode='claimed' then
    update public.plan_allocations
      set amount_cents=p_budget_cents
      where plan_id=p_plan_id and user_id=v_plan.claimed_by;

    select coalesce(sum(a.amount_cents),0) into v_needed
    from public.plan_allocations a
    join public.planned_expenses p on p.id=a.plan_id
    where a.fund_id=v_plan.fund_id
      and a.user_id=v_plan.claimed_by
      and p.status in ('planned','ready');

    select coalesce(amount_cents,0) into v_current
    from public.commitments
    where fund_id=v_plan.fund_id and user_id=v_plan.claimed_by
    for update;
    v_current := coalesce(v_current,0);

    if v_current < v_needed then
      insert into public.commitments(fund_id,user_id,amount_cents,strength,status,updated_at)
      values(v_plan.fund_id,v_plan.claimed_by,v_needed,'firm','active',now())
      on conflict(fund_id,user_id) do update
        set amount_cents=v_needed,status='active',updated_at=now();
      update public.fund_members
        set share_cents=v_needed,spend_limit_cents=v_needed
        where fund_id=v_plan.fund_id and user_id=v_plan.claimed_by;
      insert into public.commitment_events(
        fund_id,user_id,event_type,amount_delta_cents,resulting_amount_cents,metadata
      ) values(
        v_plan.fund_id,v_plan.claimed_by,'increased',v_needed-v_current,v_needed,
        jsonb_build_object('reason','claimed_expense_edited','plan_id',p_plan_id)
      );
    end if;
  elsif v_plan.allocation_mode='split_equal' and v_old_budget<>p_budget_cents then
    delete from public.plan_allocations where plan_id=p_plan_id;
    with members as (
      select user_id,row_number() over(order by joined_at,user_id) rn,count(*) over() cnt
      from public.fund_members where fund_id=v_plan.fund_id and status='active'
    )
    insert into public.plan_allocations(plan_id,fund_id,user_id,amount_cents)
    select p_plan_id,v_plan.fund_id,user_id,
      (p_budget_cents/cnt) + case when rn <= (p_budget_cents%cnt) then 1 else 0 end
    from members;
  end if;
end $$;
grant execute on function public.update_plan_simple(uuid,text,text,bigint,date,text) to authenticated;

-- Planned expenses can be removed without destroying history: they are soft-cancelled.
-- Only the creator or goal owner may remove one, and paid expenses remain immutable.
create or replace function public.cancel_plan(p_plan_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_plan public.planned_expenses;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_plan from public.planned_expenses where id=p_plan_id for update;
  if v_plan.id is null or not public.is_fund_member(v_plan.fund_id,auth.uid()) then raise exception 'Expense not found'; end if;
  if v_plan.status='paid' then raise exception 'Paid expenses cannot be removed'; end if;
  if v_plan.created_by<>auth.uid() and not public.is_fund_owner(v_plan.fund_id,auth.uid()) then
    raise exception 'Only the expense creator or goal owner can remove this expense';
  end if;
  delete from public.plan_allocations where plan_id=p_plan_id;
  update public.planned_expenses
    set status='cancelled',allocation_mode='unassigned',claimed_by=null,updated_at=now()
    where id=p_plan_id;
end $$;
grant execute on function public.cancel_plan(uuid) to authenticated;
