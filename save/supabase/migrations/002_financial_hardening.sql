-- SAVE financial hardening migration
-- Backward-safe additions for external bank accounts, ACH movements, autopay, payouts,
-- expense allocation, wallet provisioning audit and webhook reconciliation.

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.funds add column if not exists available_balance_cents bigint not null default 0;
alter table public.funds add column if not exists reserved_balance_cents bigint not null default 0;
alter table public.funds add column if not exists closed_at timestamptz;

-- Expand ledger types without deleting any existing rows.
alter table public.ledger_entries drop constraint if exists ledger_entries_entry_type_check;
alter table public.ledger_entries add constraint ledger_entries_entry_type_check check (
  entry_type in ('contribution','purchase','refund','adjustment','reservation','release','transfer','payout','fee')
);
alter table public.ledger_entries add column if not exists settled_at timestamptz;
alter table public.ledger_entries add column if not exists idempotency_key uuid;
create unique index if not exists ledger_provider_reference_unique on public.ledger_entries(provider,provider_reference)
where provider_reference is not null;
create unique index if not exists ledger_idempotency_unique on public.ledger_entries(idempotency_key)
where idempotency_key is not null;

create table if not exists public.external_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lithic_external_account_token uuid not null unique,
  owner_name text not null,
  account_type text not null default 'CHECKING' check (account_type in ('CHECKING','SAVINGS')),
  last_four text,
  state text,
  verification_state text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists external_bank_accounts_user_idx on public.external_bank_accounts(user_id,created_at desc);

create table if not exists public.money_movements (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  external_bank_account_id uuid references public.external_bank_accounts(id) on delete set null,
  direction text not null check (direction in ('contribution','payout')),
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'initiated' check (status in ('initiated','pending','processing','settled','failed','reversed','refunded','cancelled')),
  provider text not null default 'lithic',
  provider_reference text,
  idempotency_key uuid not null default gen_random_uuid(),
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  settled_at timestamptz,
  unique(idempotency_key),
  unique(provider,provider_reference)
);
create index if not exists money_movements_fund_idx on public.money_movements(fund_id,requested_at desc);
create index if not exists money_movements_user_idx on public.money_movements(user_id,requested_at desc);
create index if not exists money_movements_status_idx on public.money_movements(status,requested_at);

create table if not exists public.expense_allocations (
  id uuid primary key default gen_random_uuid(),
  ledger_entry_id uuid not null references public.ledger_entries(id) on delete cascade,
  fund_id uuid not null references public.funds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  unique(ledger_entry_id,user_id)
);
create index if not exists expense_allocations_fund_user_idx on public.expense_allocations(fund_id,user_id);

create table if not exists public.wallet_provision_attempts (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallet text not null check (wallet in ('APPLE_PAY','GOOGLE_PAY')),
  status text not null default 'initiated' check (status in ('initiated','ready','completed','failed')),
  provider_reference text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'lithic',
  provider_event_id text not null,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received' check (processing_status in ('received','processed','ignored','failed')),
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider,provider_event_id)
);

alter table public.contribution_plans add column if not exists external_bank_account_id uuid references public.external_bank_accounts(id) on delete set null;
alter table public.contribution_plans add column if not exists start_at timestamptz;
alter table public.contribution_plans add column if not exists last_run_at timestamptz;
alter table public.contribution_plans add column if not exists last_status text;
alter table public.contribution_plans add column if not exists failure_count integer not null default 0;
alter table public.contribution_plans add column if not exists updated_at timestamptz not null default now();
create index if not exists contribution_plans_due_idx on public.contribution_plans(status,next_run_at)
where status='active';

create or replace function public.recalculate_fund_balance(p_fund_id uuid)
returns bigint language plpgsql security definer set search_path=public as $$
declare v_balance bigint;
begin
  select greatest(0,coalesce(sum(amount_cents),0)) into v_balance
  from public.ledger_entries where fund_id=p_fund_id;
  update public.funds
     set current_balance_cents=v_balance,
         available_balance_cents=greatest(0,v_balance-coalesce(reserved_balance_cents,0)),
         updated_at=now()
   where id=p_fund_id;
  return v_balance;
end $$;
revoke all on function public.recalculate_fund_balance(uuid) from public,anon,authenticated;

create or replace function public.user_refundable_cents(p_fund_id uuid,p_user_id uuid default auth.uid())
returns bigint language plpgsql stable security definer set search_path=public as $$
declare v_total bigint;
begin
  if auth.uid() is not null and p_user_id <> auth.uid() then raise exception 'Not authorized'; end if;
  with contributed as (
    select coalesce(sum(amount_cents),0)::bigint total
    from public.ledger_entries
    where fund_id=p_fund_id and user_id=p_user_id
      and entry_type in ('contribution','refund','adjustment','payout')
  ), allocated as (
    select coalesce(sum(amount_cents),0)::bigint total
    from public.expense_allocations where fund_id=p_fund_id and user_id=p_user_id
  )
  select greatest(0,(select total from contributed)-(select total from allocated)) into v_total;
  return v_total;
end $$;
grant execute on function public.user_refundable_cents(uuid,uuid) to authenticated;

create or replace function public.next_plan_run(p_from timestamptz,p_cadence text)
returns timestamptz language sql immutable as $$
  select case p_cadence
    when 'weekly' then p_from + interval '7 days'
    when 'biweekly' then p_from + interval '14 days'
    when 'monthly' then p_from + interval '1 month'
    else p_from + interval '7 days' end;
$$;

-- New RLS boundaries.
alter table public.external_bank_accounts enable row level security;
alter table public.money_movements enable row level security;
alter table public.expense_allocations enable row level security;
alter table public.wallet_provision_attempts enable row level security;
alter table public.provider_webhook_events enable row level security;

create policy "users read own external banks" on public.external_bank_accounts for select to authenticated using (user_id=auth.uid());
create policy "users read own movements" on public.money_movements for select to authenticated using (user_id=auth.uid() and public.is_fund_member(fund_id));
create policy "members read expense allocations" on public.expense_allocations for select to authenticated using (public.is_fund_member(fund_id));
create policy "users read own wallet attempts" on public.wallet_provision_attempts for select to authenticated using (user_id=auth.uid());
-- No direct client policies for provider webhook events; service role only.

-- Contribution plans remain user-managed, but protect server-owned lifecycle fields from direct writes
-- by routing create/update through this RPC.
create or replace function public.save_contribution_plan(
  p_fund_id uuid,
  p_bank_account_id uuid,
  p_amount_cents bigint,
  p_cadence text,
  p_next_run_at timestamptz,
  p_status text default 'active'
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_fund_member(p_fund_id,auth.uid()) then raise exception 'Not authorized'; end if;
  if p_amount_cents < 100 then raise exception 'Minimum recurring contribution is $1.00'; end if;
  if p_cadence not in ('weekly','biweekly','monthly') then raise exception 'Invalid cadence'; end if;
  if p_status not in ('active','paused','cancelled') then raise exception 'Invalid status'; end if;
  if not exists(select 1 from public.external_bank_accounts where id=p_bank_account_id and user_id=auth.uid() and verification_state='ENABLED') then
    raise exception 'Verified bank account required';
  end if;
  insert into public.contribution_plans(fund_id,user_id,amount_cents,cadence,next_run_at,external_bank_account_id,status,start_at)
  values(p_fund_id,auth.uid(),p_amount_cents,p_cadence,p_next_run_at,p_bank_account_id,p_status,coalesce(p_next_run_at,now()))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.save_contribution_plan(uuid,uuid,bigint,text,timestamptz,text) to authenticated;

create or replace function public.set_contribution_plan_status(p_plan_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_status not in ('active','paused','cancelled') then raise exception 'Invalid status'; end if;
  update public.contribution_plans set status=p_status,updated_at=now()
  where id=p_plan_id and user_id=auth.uid();
  if not found then raise exception 'Plan not found'; end if;
end $$;
grant execute on function public.set_contribution_plan_status(uuid,text) to authenticated;

-- Remove permissive direct mutation policy from the first schema and replace with read-only + RPC mutation.
drop policy if exists "users manage own contribution plans" on public.contribution_plans;
create policy "members read contribution plans hardened" on public.contribution_plans for select to authenticated
using (public.is_fund_member(fund_id));

-- Realtime: money movements and plans are useful to the active user; webhook payloads are not.
do $$ begin alter publication supabase_realtime add table public.money_movements; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.contribution_plans; exception when duplicate_object then null; end $$;

-- Real-time card authorization reservations for Lithic ASA fair-share enforcement.
create table if not exists public.card_authorization_reservations (
  id uuid primary key default gen_random_uuid(),
  transaction_token uuid not null unique,
  card_id uuid not null references public.cards(id) on delete cascade,
  fund_id uuid not null references public.funds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  merchant text,
  status text not null default 'pending' check (status in ('pending','settled','voided','declined','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists card_auth_res_fund_status_idx on public.card_authorization_reservations(fund_id,status);
create index if not exists card_auth_res_user_status_idx on public.card_authorization_reservations(user_id,status);
alter table public.card_authorization_reservations enable row level security;
create policy "members read card reservations" on public.card_authorization_reservations for select to authenticated using (public.is_fund_member(fund_id));

create or replace function public.reserve_card_authorization(
  p_card_token uuid,
  p_transaction_token uuid,
  p_amount_cents bigint,
  p_merchant text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  c public.cards; f public.funds; m public.fund_members;
  v_group_pending bigint; v_user_pending bigint; v_user_spent bigint;
  v_group_available bigint; v_personal_available bigint;
begin
  if p_amount_cents <= 0 then return jsonb_build_object('approved',true,'reason','non_debit'); end if;
  select * into c from public.cards where lithic_card_token=p_card_token;
  if c.id is null then return jsonb_build_object('approved',false,'reason','card_not_found'); end if;
  if exists(select 1 from public.card_authorization_reservations where transaction_token=p_transaction_token and status='pending') then
    return jsonb_build_object('approved',true,'reason','already_reserved');
  end if;
  select * into f from public.funds where id=c.fund_id for update;
  select * into m from public.fund_members where fund_id=c.fund_id and user_id=c.user_id and status='active' for update;
  if m.id is null or f.status<>'active' then return jsonb_build_object('approved',false,'reason','inactive'); end if;

  select coalesce(sum(amount_cents),0) into v_group_pending from public.card_authorization_reservations where fund_id=f.id and status='pending';
  select coalesce(sum(amount_cents),0) into v_user_pending from public.card_authorization_reservations where user_id=c.user_id and fund_id=f.id and status='pending';
  select coalesce(sum(abs(amount_cents)),0) into v_user_spent from public.ledger_entries where fund_id=f.id and user_id=c.user_id and entry_type='purchase' and amount_cents<0;
  v_group_available := greatest(0,f.current_balance_cents-v_group_pending);
  if f.spending_mode='open_wallet' then
    v_personal_available := v_group_available;
  else
    v_personal_available := greatest(0,coalesce(m.spend_limit_cents,m.share_cents,0)-v_user_spent-v_user_pending);
  end if;
  if p_amount_cents > v_group_available or p_amount_cents > v_personal_available then
    return jsonb_build_object('approved',false,'reason','insufficient_funds','group_available',v_group_available,'personal_available',v_personal_available);
  end if;
  insert into public.card_authorization_reservations(transaction_token,card_id,fund_id,user_id,amount_cents,merchant)
  values(p_transaction_token,c.id,c.fund_id,c.user_id,p_amount_cents,left(coalesce(p_merchant,''),200))
  on conflict(transaction_token) do nothing;
  return jsonb_build_object('approved',true,'reason','reserved','group_available',v_group_available-p_amount_cents,'personal_available',v_personal_available-p_amount_cents);
end $$;
revoke all on function public.reserve_card_authorization(uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.reserve_card_authorization(uuid,uuid,bigint,text) to service_role;

alter table public.card_transactions add column if not exists pending_amount_cents bigint not null default 0;
alter table public.card_transactions add column if not exists settled_amount_cents bigint not null default 0;
alter table public.card_transactions add column if not exists updated_at timestamptz not null default now();

-- Payout reservations prevent concurrent requests from returning the same dollars twice.
create or replace function public.reserve_payout_movement(
  p_fund_id uuid,p_user_id uuid,p_bank_account_id uuid,p_amount_cents bigint,p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_contributed bigint; v_allocated bigint; v_pending bigint; v_refundable bigint;
begin
  if p_amount_cents <= 0 then raise exception 'Amount must be positive'; end if;
  perform 1 from public.fund_members where fund_id=p_fund_id and user_id=p_user_id and status='active' for update;
  if not found then raise exception 'Not a fund member'; end if;
  if not exists(select 1 from public.external_bank_accounts where id=p_bank_account_id and user_id=p_user_id and verification_state='ENABLED') then raise exception 'Verified bank account required'; end if;
  select coalesce(sum(amount_cents),0) into v_contributed from public.ledger_entries where fund_id=p_fund_id and user_id=p_user_id and entry_type in ('contribution','refund','adjustment','payout');
  select coalesce(sum(amount_cents),0) into v_allocated from public.expense_allocations where fund_id=p_fund_id and user_id=p_user_id;
  select coalesce(sum(amount_cents),0) into v_pending from public.money_movements where fund_id=p_fund_id and user_id=p_user_id and direction='payout' and status in ('initiated','pending','processing');
  v_refundable:=greatest(0,v_contributed-v_allocated-v_pending);
  if p_amount_cents>v_refundable then raise exception 'Requested payout exceeds refundable balance'; end if;
  insert into public.money_movements(fund_id,user_id,external_bank_account_id,direction,amount_cents,status,idempotency_key,metadata)
  values(p_fund_id,p_user_id,p_bank_account_id,'payout',p_amount_cents,'initiated',p_idempotency_key,jsonb_build_object('source','save-web')) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.reserve_payout_movement(uuid,uuid,uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function public.reserve_payout_movement(uuid,uuid,uuid,bigint,uuid) to service_role;

create or replace function public.user_refundable_cents(p_fund_id uuid,p_user_id uuid default auth.uid())
returns bigint language plpgsql stable security definer set search_path=public as $$
declare v_contributed bigint; v_allocated bigint; v_pending bigint;
begin
  if auth.uid() is not null and p_user_id <> auth.uid() then raise exception 'Not authorized'; end if;
  select coalesce(sum(amount_cents),0) into v_contributed from public.ledger_entries where fund_id=p_fund_id and user_id=p_user_id and entry_type in ('contribution','refund','adjustment','payout');
  select coalesce(sum(amount_cents),0) into v_allocated from public.expense_allocations where fund_id=p_fund_id and user_id=p_user_id;
  select coalesce(sum(amount_cents),0) into v_pending from public.money_movements where fund_id=p_fund_id and user_id=p_user_id and direction='payout' and status in ('initiated','pending','processing');
  return greatest(0,v_contributed-v_allocated-v_pending);
end $$;
grant execute on function public.user_refundable_cents(uuid,uuid) to authenticated;
