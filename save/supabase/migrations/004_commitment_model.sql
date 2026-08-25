-- Save 004: Commitment model
-- Additive migration. Does not remove prior payment/Lithic/PayPal tables so existing data remains intact.

create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  strength text not null default 'firm' check (strength in ('firm','flexible','tentative')),
  auto_build_cents bigint not null default 0 check (auto_build_cents >= 0),
  auto_build_cadence text check (auto_build_cadence is null or auto_build_cadence in ('weekly','biweekly','monthly')),
  next_build_on date,
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(fund_id,user_id)
);

create table if not exists public.commitment_events (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('created','increased','decreased','auto_build','strength_changed','paused','resumed')),
  amount_delta_cents bigint not null default 0,
  resulting_amount_cents bigint not null default 0 check (resulting_amount_cents >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.planned_expenses (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(trim(title)) between 1 and 120),
  category text not null default 'Other',
  budget_cents bigint not null check (budget_cents > 0),
  actual_cents bigint check (actual_cents is null or actual_cents >= 0),
  due_date date,
  status text not null default 'planned' check (status in ('planned','ready','paid','cancelled')),
  paid_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_allocations (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.planned_expenses(id) on delete cascade,
  fund_id uuid not null references public.funds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  unique(plan_id,user_id)
);

create table if not exists public.funding_calls (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  plan_id uuid references public.planned_expenses(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(trim(title)) between 1 and 140),
  total_cents bigint not null check (total_cents > 0),
  due_date date,
  status text not null default 'open' check (status in ('open','completed','cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.funding_call_shares (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.funding_calls(id) on delete cascade,
  fund_id uuid not null references public.funds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending','paid','covered','declined')),
  paid_by uuid references public.profiles(id) on delete set null,
  note text,
  updated_at timestamptz not null default now(),
  unique(call_id,user_id)
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  call_id uuid references public.funding_calls(id) on delete set null,
  from_user uuid not null references public.profiles(id),
  to_user uuid not null references public.profiles(id),
  amount_cents bigint not null check (amount_cents > 0),
  method text,
  note text,
  status text not null default 'pending' check (status in ('pending','sent','confirmed','cancelled')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  check (from_user <> to_user)
);

create index if not exists commitments_fund_idx on public.commitments(fund_id,status);
create index if not exists commitments_user_idx on public.commitments(user_id,status);
create index if not exists plans_fund_status_idx on public.planned_expenses(fund_id,status,due_date);
create index if not exists allocations_fund_user_idx on public.plan_allocations(fund_id,user_id);
create index if not exists calls_fund_status_idx on public.funding_calls(fund_id,status,due_date);
create index if not exists call_shares_user_idx on public.funding_call_shares(user_id,status);
create index if not exists settlements_fund_status_idx on public.settlements(fund_id,status,created_at desc);

-- Give pre-existing goal members a neutral commitment record without reinterpreting old payment data as a promise.
insert into public.commitments(fund_id,user_id,amount_cents,strength,status)
select fm.fund_id,fm.user_id,0,'firm','active'
from public.fund_members fm
where fm.status='active'
on conflict(fund_id,user_id) do nothing;

-- Goal creation for the commitment-era UI. Reuses the existing funds/membership tables for compatibility.
create or replace function public.create_commitment_goal(
  p_name text,
  p_emoji text,
  p_category text,
  p_goal_cents bigint,
  p_goal_date date,
  p_initial_commitment_cents bigint default 0
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_goal_cents <= 0 then raise exception 'Goal must be positive'; end if;
  if p_initial_commitment_cents < 0 then raise exception 'Commitment cannot be negative'; end if;
  insert into public.profiles(id,display_name)
  values(auth.uid(),coalesce((select raw_user_meta_data->>'full_name' from auth.users where id=auth.uid()),split_part((select email from auth.users where id=auth.uid()),'@',1),'Saver'))
  on conflict(id) do nothing;
  insert into public.funds(owner_id,name,emoji,category,goal_cents,goal_date,spending_mode,current_balance_cents)
  values(auth.uid(),trim(p_name),coalesce(nullif(p_emoji,''),'✦'),coalesce(nullif(p_category,''),'Other'),p_goal_cents,p_goal_date,'fair_share',0)
  returning id into v_id;
  insert into public.fund_members(fund_id,user_id,role,share_cents,spend_limit_cents)
  values(v_id,auth.uid(),'owner',p_initial_commitment_cents,p_initial_commitment_cents);
  insert into public.commitments(fund_id,user_id,amount_cents,strength)
  values(v_id,auth.uid(),p_initial_commitment_cents,'firm');
  insert into public.commitment_events(fund_id,user_id,event_type,amount_delta_cents,resulting_amount_cents)
  values(v_id,auth.uid(),'created',p_initial_commitment_cents,p_initial_commitment_cents);
  return v_id;
end $$;
grant execute on function public.create_commitment_goal(text,text,text,bigint,date,bigint) to authenticated;

-- Join without pretending an equal dollar share has been agreed to.
create or replace function public.join_commitment_goal(p_code text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_fund public.funds;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_fund from public.funds where invite_code=upper(trim(p_code)) and status='active';
  if v_fund.id is null then raise exception 'Invite code not found'; end if;
  insert into public.fund_members(fund_id,user_id,role,share_cents,spend_limit_cents,status)
  values(v_fund.id,auth.uid(),'member',0,0,'active')
  on conflict(fund_id,user_id) do update set status='active';
  insert into public.commitments(fund_id,user_id,amount_cents,strength)
  values(v_fund.id,auth.uid(),0,'firm') on conflict(fund_id,user_id) do nothing;
  return v_fund.id;
end $$;
grant execute on function public.join_commitment_goal(text) to authenticated;

create or replace function public.set_my_commitment(
  p_fund_id uuid,
  p_amount_cents bigint,
  p_strength text,
  p_auto_build_cents bigint default 0,
  p_auto_build_cadence text default null
) returns void language plpgsql security definer set search_path=public as $$
declare v_old bigint := 0; v_event text;
begin
  if not public.is_fund_member(p_fund_id,auth.uid()) then raise exception 'Not a member'; end if;
  if p_amount_cents < 0 or p_auto_build_cents < 0 then raise exception 'Amounts cannot be negative'; end if;
  if p_strength not in ('firm','flexible','tentative') then raise exception 'Invalid commitment strength'; end if;
  if p_auto_build_cadence is not null and p_auto_build_cadence not in ('weekly','biweekly','monthly') then raise exception 'Invalid cadence'; end if;
  select amount_cents into v_old from public.commitments where fund_id=p_fund_id and user_id=auth.uid() for update;
  v_old := coalesce(v_old,0);
  if p_amount_cents > v_old then v_event := 'increased'; elsif p_amount_cents < v_old then v_event := 'decreased'; else v_event := 'strength_changed'; end if;
  insert into public.commitments(fund_id,user_id,amount_cents,strength,auto_build_cents,auto_build_cadence,next_build_on,status,updated_at)
  values(p_fund_id,auth.uid(),p_amount_cents,p_strength,p_auto_build_cents,p_auto_build_cadence,
    case when p_auto_build_cents>0 and p_auto_build_cadence is not null then
      case p_auto_build_cadence when 'weekly' then current_date+7 when 'biweekly' then current_date+14 when 'monthly' then (current_date+interval '1 month')::date end
      else null end,
    case when p_auto_build_cents>0 and p_auto_build_cadence is not null then 'active' else 'paused' end,now())
  on conflict(fund_id,user_id) do update set amount_cents=excluded.amount_cents,strength=excluded.strength,
    auto_build_cents=excluded.auto_build_cents,auto_build_cadence=excluded.auto_build_cadence,
    next_build_on=excluded.next_build_on,status=excluded.status,updated_at=now();
  update public.fund_members set share_cents=p_amount_cents,spend_limit_cents=p_amount_cents where fund_id=p_fund_id and user_id=auth.uid();
  insert into public.commitment_events(fund_id,user_id,event_type,amount_delta_cents,resulting_amount_cents)
  values(p_fund_id,auth.uid(),v_event,p_amount_cents-v_old,p_amount_cents);
end $$;
grant execute on function public.set_my_commitment(uuid,bigint,text,bigint,text) to authenticated;

create or replace function public.create_plan_equal(
  p_fund_id uuid,p_title text,p_category text,p_budget_cents bigint,p_due_date date,p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_plan uuid; v_count int; v_base bigint; v_remainder bigint; r record; i int := 0;
begin
  if not public.is_fund_member(p_fund_id,auth.uid()) then raise exception 'Not a member'; end if;
  if p_budget_cents <= 0 then raise exception 'Budget must be positive'; end if;
  select count(*) into v_count from public.fund_members where fund_id=p_fund_id and status='active';
  if v_count=0 then raise exception 'No members'; end if;
  insert into public.planned_expenses(fund_id,created_by,title,category,budget_cents,due_date,notes)
  values(p_fund_id,auth.uid(),trim(p_title),coalesce(nullif(p_category,''),'Other'),p_budget_cents,p_due_date,nullif(trim(coalesce(p_notes,'')),'')) returning id into v_plan;
  v_base := p_budget_cents / v_count; v_remainder := p_budget_cents % v_count;
  for r in select user_id from public.fund_members where fund_id=p_fund_id and status='active' order by joined_at loop
    i := i + 1;
    insert into public.plan_allocations(plan_id,fund_id,user_id,amount_cents)
    values(v_plan,p_fund_id,r.user_id,v_base + case when i <= v_remainder then 1 else 0 end);
  end loop;
  return v_plan;
end $$;
grant execute on function public.create_plan_equal(uuid,text,text,bigint,date,text) to authenticated;

create or replace function public.mark_plan_paid(
  p_plan_id uuid,p_actual_cents bigint,p_paid_by uuid
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_plan public.planned_expenses; v_call uuid; v_total_alloc bigint; r record; v_share bigint; v_count int; v_running bigint := 0; v_i int := 0;
begin
  select * into v_plan from public.planned_expenses where id=p_plan_id for update;
  if v_plan.id is null or not public.is_fund_member(v_plan.fund_id,auth.uid()) then raise exception 'Plan not found'; end if;
  if p_actual_cents <= 0 then raise exception 'Actual amount must be positive'; end if;
  if not public.is_fund_member(v_plan.fund_id,p_paid_by) then raise exception 'Payer must be a member'; end if;
  if v_plan.status='paid' then raise exception 'Plan is already paid'; end if;
  update public.planned_expenses set actual_cents=p_actual_cents,paid_by=p_paid_by,status='paid',updated_at=now() where id=p_plan_id;
  insert into public.funding_calls(fund_id,plan_id,created_by,title,total_cents,due_date,status)
  values(v_plan.fund_id,p_plan_id,auth.uid(),v_plan.title,p_actual_cents,current_date + 7,'open') returning id into v_call;
  select count(*),coalesce(sum(amount_cents),0) into v_count,v_total_alloc from public.plan_allocations where plan_id=p_plan_id;
  for r in select user_id,amount_cents,row_number() over(order by created_at,id) rn from public.plan_allocations where plan_id=p_plan_id order by created_at,id loop
    v_i := v_i + 1;
    if v_i=v_count then v_share:=p_actual_cents-v_running;
    elsif v_total_alloc>0 then v_share:=round((p_actual_cents::numeric*r.amount_cents::numeric)/v_total_alloc)::bigint;
    else v_share:=floor(p_actual_cents/greatest(v_count,1)); end if;
    v_running := v_running+v_share;
    insert into public.funding_call_shares(call_id,fund_id,user_id,amount_cents,status,paid_by)
    values(v_call,v_plan.fund_id,r.user_id,v_share,case when r.user_id=p_paid_by then 'covered' else 'pending' end,p_paid_by);
    if r.user_id<>p_paid_by and v_share>0 then
      insert into public.settlements(fund_id,call_id,from_user,to_user,amount_cents,status)
      values(v_plan.fund_id,v_call,r.user_id,p_paid_by,v_share,'pending');
    end if;
  end loop;
  return v_call;
end $$;
grant execute on function public.mark_plan_paid(uuid,bigint,uuid) to authenticated;

create or replace function public.mark_my_call_share_paid(p_share_id uuid,p_method text default null,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_share public.funding_call_shares; v_call uuid;
begin
  select * into v_share from public.funding_call_shares where id=p_share_id for update;
  if v_share.id is null or v_share.user_id<>auth.uid() then raise exception 'Share not found'; end if;
  if v_share.status not in ('pending','declined') then return; end if;
  update public.funding_call_shares set status='paid',note=nullif(trim(coalesce(p_note,'')),''),updated_at=now() where id=p_share_id;
  update public.settlements set status='sent',method=nullif(trim(coalesce(p_method,'')),''),note=nullif(trim(coalesce(p_note,'')),'' )
  where call_id=v_share.call_id and from_user=auth.uid() and status='pending';
  v_call:=v_share.call_id;
  if not exists(select 1 from public.funding_call_shares where call_id=v_call and status in ('pending','declined')) then
    update public.funding_calls set status='completed',completed_at=now() where id=v_call;
  end if;
end $$;
grant execute on function public.mark_my_call_share_paid(uuid,text,text) to authenticated;

create or replace function public.confirm_settlement(p_settlement_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare s public.settlements;
begin
  select * into s from public.settlements where id=p_settlement_id for update;
  if s.id is null or s.to_user<>auth.uid() then raise exception 'Settlement not found'; end if;
  update public.settlements set status='confirmed',confirmed_at=now() where id=p_settlement_id;
end $$;
grant execute on function public.confirm_settlement(uuid) to authenticated;

alter table public.commitments enable row level security;
alter table public.commitment_events enable row level security;
alter table public.planned_expenses enable row level security;
alter table public.plan_allocations enable row level security;
alter table public.funding_calls enable row level security;
alter table public.funding_call_shares enable row level security;
alter table public.settlements enable row level security;

create policy "members read commitments" on public.commitments for select to authenticated using (public.is_fund_member(fund_id));
create policy "members read commitment events" on public.commitment_events for select to authenticated using (public.is_fund_member(fund_id));
create policy "members read plans" on public.planned_expenses for select to authenticated using (public.is_fund_member(fund_id));
create policy "members read allocations" on public.plan_allocations for select to authenticated using (public.is_fund_member(fund_id));
create policy "members read calls" on public.funding_calls for select to authenticated using (public.is_fund_member(fund_id));
create policy "members read call shares" on public.funding_call_shares for select to authenticated using (public.is_fund_member(fund_id));
create policy "members read settlements" on public.settlements for select to authenticated using (public.is_fund_member(fund_id));

-- Realtime collaboration for promise data.
do $$ begin alter publication supabase_realtime add table public.commitments; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.planned_expenses; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.plan_allocations; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.funding_calls; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.funding_call_shares; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.settlements; exception when duplicate_object then null; end $$;

-- Atomic scheduled commitment growth. Intended for the server-side Auto Commit worker only.
create or replace function public.process_due_auto_commits()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; v_next date; v_count integer := 0; v_new bigint;
begin
  for r in
    select * from public.commitments
    where status='active' and auto_build_cents>0 and auto_build_cadence is not null
      and next_build_on is not null and next_build_on<=current_date
    for update skip locked
  loop
    v_new := r.amount_cents + r.auto_build_cents;
    v_next := case r.auto_build_cadence
      when 'weekly' then r.next_build_on + 7
      when 'biweekly' then r.next_build_on + 14
      when 'monthly' then (r.next_build_on + interval '1 month')::date
      else null end;
    update public.commitments set amount_cents=v_new,next_build_on=v_next,updated_at=now() where id=r.id;
    update public.fund_members set share_cents=v_new,spend_limit_cents=v_new where fund_id=r.fund_id and user_id=r.user_id;
    insert into public.commitment_events(fund_id,user_id,event_type,amount_delta_cents,resulting_amount_cents,metadata)
    values(r.fund_id,r.user_id,'auto_build',r.auto_build_cents,v_new,jsonb_build_object('cadence',r.auto_build_cadence));
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.process_due_auto_commits() from public, anon, authenticated;
grant execute on function public.process_due_auto_commits() to service_role;
