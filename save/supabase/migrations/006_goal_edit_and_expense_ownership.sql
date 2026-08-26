-- Save 006: editable goals + simpler expense ownership
-- Safe incremental migration for an existing Save database. Do NOT rerun schema.sql.

alter table public.funds add column if not exists description text;
alter table public.planned_expenses add column if not exists allocation_mode text not null default 'unassigned';
alter table public.planned_expenses add column if not exists claimed_by uuid references public.profiles(id) on delete set null;

-- Preserve the meaning of existing equal-allocation plans created before this migration.
update public.planned_expenses p
set allocation_mode = 'split_equal'
where allocation_mode = 'unassigned'
  and exists (select 1 from public.plan_allocations a where a.plan_id = p.id);

create or replace function public.update_goal_details(
  p_fund_id uuid,
  p_name text,
  p_emoji text,
  p_category text,
  p_goal_cents bigint,
  p_goal_date date,
  p_description text default null
) returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from public.funds where id=p_fund_id and owner_id=auth.uid()) then
    raise exception 'Only the goal owner can edit this goal';
  end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 80 then raise exception 'Goal name is required'; end if;
  if p_goal_cents <= 0 then raise exception 'Goal amount must be positive'; end if;
  update public.funds
  set name=trim(p_name), emoji=coalesce(nullif(trim(p_emoji),''),'✦'),
      category=coalesce(nullif(trim(p_category),''),'Other'), goal_cents=p_goal_cents,
      goal_date=p_goal_date, description=nullif(trim(coalesce(p_description,'')),''), updated_at=now()
  where id=p_fund_id;
end $$;
grant execute on function public.update_goal_details(uuid,text,text,text,bigint,date,text) to authenticated;

create or replace function public.create_plan_simple(
  p_fund_id uuid,
  p_title text,
  p_category text,
  p_budget_cents bigint,
  p_due_date date,
  p_notes text default null,
  p_coverage_mode text default 'unassigned'
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_plan uuid; v_count int; v_base bigint; v_remainder bigint; r record; i int := 0;
  v_other_reserved bigint := 0; v_needed bigint := 0; v_current bigint := 0;
begin
  if not public.is_fund_member(p_fund_id,auth.uid()) then raise exception 'Not a member'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 1 and 120 then raise exception 'Expense name is required'; end if;
  if p_budget_cents <= 0 then raise exception 'Expense amount must be positive'; end if;
  if p_coverage_mode not in ('unassigned','claimed','split_equal') then raise exception 'Invalid coverage mode'; end if;

  insert into public.planned_expenses(fund_id,created_by,title,category,budget_cents,due_date,notes,allocation_mode,claimed_by)
  values(p_fund_id,auth.uid(),trim(p_title),coalesce(nullif(p_category,''),'Other'),p_budget_cents,p_due_date,
         nullif(trim(coalesce(p_notes,'')),''),p_coverage_mode,case when p_coverage_mode='claimed' then auth.uid() else null end)
  returning id into v_plan;

  if p_coverage_mode='claimed' then
    insert into public.plan_allocations(plan_id,fund_id,user_id,amount_cents)
    values(v_plan,p_fund_id,auth.uid(),p_budget_cents);

    select coalesce(sum(a.amount_cents),0) into v_other_reserved
    from public.plan_allocations a
    join public.planned_expenses p on p.id=a.plan_id
    where a.fund_id=p_fund_id and a.user_id=auth.uid() and p.status in ('planned','ready');
    v_needed := v_other_reserved;
    select coalesce(amount_cents,0) into v_current from public.commitments where fund_id=p_fund_id and user_id=auth.uid();
    if v_current < v_needed then
      insert into public.commitments(fund_id,user_id,amount_cents,strength,status,updated_at)
      values(p_fund_id,auth.uid(),v_needed,'firm','active',now())
      on conflict(fund_id,user_id) do update set amount_cents=v_needed,updated_at=now();
      update public.fund_members set share_cents=v_needed,spend_limit_cents=v_needed where fund_id=p_fund_id and user_id=auth.uid();
      insert into public.commitment_events(fund_id,user_id,event_type,amount_delta_cents,resulting_amount_cents,metadata)
      values(p_fund_id,auth.uid(),'increased',v_needed-v_current,v_needed,jsonb_build_object('reason','claimed_expense','plan_id',v_plan));
    end if;
  elsif p_coverage_mode='split_equal' then
    select count(*) into v_count from public.fund_members where fund_id=p_fund_id and status='active';
    if v_count=0 then raise exception 'No active members'; end if;
    v_base := p_budget_cents / v_count; v_remainder := p_budget_cents % v_count;
    for r in select user_id from public.fund_members where fund_id=p_fund_id and status='active' order by joined_at loop
      i := i + 1;
      insert into public.plan_allocations(plan_id,fund_id,user_id,amount_cents)
      values(v_plan,p_fund_id,r.user_id,v_base + case when i <= v_remainder then 1 else 0 end);
    end loop;
  end if;
  return v_plan;
end $$;
grant execute on function public.create_plan_simple(uuid,text,text,bigint,date,text,text) to authenticated;

create or replace function public.update_plan_simple(
  p_plan_id uuid,
  p_title text,
  p_category text,
  p_budget_cents bigint,
  p_due_date date,
  p_notes text default null
) returns void language plpgsql security definer set search_path=public as $$
declare v_plan public.planned_expenses; v_old_budget bigint;
begin
  select * into v_plan from public.planned_expenses where id=p_plan_id for update;
  if v_plan.id is null or not public.is_fund_member(v_plan.fund_id,auth.uid()) then raise exception 'Expense not found'; end if;
  if v_plan.status='paid' then raise exception 'Paid expenses cannot be edited'; end if;
  if p_budget_cents <= 0 then raise exception 'Expense amount must be positive'; end if;
  v_old_budget := v_plan.budget_cents;
  update public.planned_expenses set title=trim(p_title),category=coalesce(nullif(p_category,''),'Other'),budget_cents=p_budget_cents,
    due_date=p_due_date,notes=nullif(trim(coalesce(p_notes,'')),''),updated_at=now() where id=p_plan_id;
  if v_plan.allocation_mode='claimed' then
    update public.plan_allocations set amount_cents=p_budget_cents where plan_id=p_plan_id and user_id=v_plan.claimed_by;
  elsif v_plan.allocation_mode='split_equal' and v_old_budget<>p_budget_cents then
    -- Recreate equal split with remainder distributed deterministically.
    delete from public.plan_allocations where plan_id=p_plan_id;
    with members as (
      select user_id,row_number() over(order by joined_at) rn,count(*) over() cnt
      from public.fund_members where fund_id=v_plan.fund_id and status='active'
    )
    insert into public.plan_allocations(plan_id,fund_id,user_id,amount_cents)
    select p_plan_id,v_plan.fund_id,user_id,
      (p_budget_cents/cnt) + case when rn <= (p_budget_cents%cnt) then 1 else 0 end
    from members;
  end if;
end $$;
grant execute on function public.update_plan_simple(uuid,text,text,bigint,date,text) to authenticated;

create or replace function public.claim_plan(p_plan_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_plan public.planned_expenses; v_needed bigint; v_current bigint;
begin
  select * into v_plan from public.planned_expenses where id=p_plan_id for update;
  if v_plan.id is null or not public.is_fund_member(v_plan.fund_id,auth.uid()) then raise exception 'Expense not found'; end if;
  if v_plan.status='paid' then raise exception 'Expense is already paid'; end if;
  delete from public.plan_allocations where plan_id=p_plan_id;
  insert into public.plan_allocations(plan_id,fund_id,user_id,amount_cents) values(p_plan_id,v_plan.fund_id,auth.uid(),v_plan.budget_cents);
  update public.planned_expenses set allocation_mode='claimed',claimed_by=auth.uid(),updated_at=now() where id=p_plan_id;
  select coalesce(sum(a.amount_cents),0) into v_needed from public.plan_allocations a join public.planned_expenses p on p.id=a.plan_id
    where a.fund_id=v_plan.fund_id and a.user_id=auth.uid() and p.status in ('planned','ready');
  select coalesce(amount_cents,0) into v_current from public.commitments where fund_id=v_plan.fund_id and user_id=auth.uid();
  if v_current < v_needed then
    insert into public.commitments(fund_id,user_id,amount_cents,strength,status,updated_at)
    values(v_plan.fund_id,auth.uid(),v_needed,'firm','active',now())
    on conflict(fund_id,user_id) do update set amount_cents=v_needed,updated_at=now();
    update public.fund_members set share_cents=v_needed,spend_limit_cents=v_needed where fund_id=v_plan.fund_id and user_id=auth.uid();
    insert into public.commitment_events(fund_id,user_id,event_type,amount_delta_cents,resulting_amount_cents,metadata)
    values(v_plan.fund_id,auth.uid(),'increased',v_needed-v_current,v_needed,jsonb_build_object('reason','claimed_expense','plan_id',p_plan_id));
  end if;
end $$;
grant execute on function public.claim_plan(uuid) to authenticated;

create or replace function public.unassign_plan(p_plan_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_fund uuid;
begin
  select fund_id into v_fund from public.planned_expenses where id=p_plan_id and status<>'paid' for update;
  if v_fund is null or not public.is_fund_member(v_fund,auth.uid()) then raise exception 'Expense not found'; end if;
  delete from public.plan_allocations where plan_id=p_plan_id;
  update public.planned_expenses set allocation_mode='unassigned',claimed_by=null,updated_at=now() where id=p_plan_id;
end $$;
grant execute on function public.unassign_plan(uuid) to authenticated;
