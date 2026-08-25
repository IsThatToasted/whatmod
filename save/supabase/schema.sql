-- SAVE / Supabase schema
-- Run in the Supabase SQL editor for project hqkiexffibcrpjkiavqg.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Saver',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.funds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  name text not null check (char_length(name) between 1 and 80),
  emoji text not null default '💸',
  category text not null default 'Other',
  goal_cents bigint not null check (goal_cents > 0),
  current_balance_cents bigint not null default 0 check (current_balance_cents >= 0),
  goal_date date,
  spending_mode text not null default 'fair_share' check (spending_mode in ('fair_share','vote_to_unlock','organizer','open_wallet')),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  status text not null default 'active' check (status in ('active','completed','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fund_members (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','organizer','member')),
  share_cents bigint not null default 0 check (share_cents >= 0),
  spend_limit_cents bigint check (spend_limit_cents is null or spend_limit_cents >= 0),
  status text not null default 'active' check (status in ('active','invited','left','removed')),
  joined_at timestamptz not null default now(),
  unique(fund_id,user_id)
);

create table if not exists public.contribution_plans (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  cadence text not null check (cadence in ('weekly','biweekly','monthly')),
  next_run_at timestamptz,
  provider_token text,
  status text not null default 'paused' check (status in ('active','paused','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  entry_type text not null check (entry_type in ('contribution','purchase','refund','adjustment','reservation','release','transfer')),
  amount_cents bigint not null,
  description text,
  provider text,
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.unlock_requests (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  reason text not null,
  approval_mode text not null default 'majority' check (approval_mode in ('majority','unanimous','owner')),
  status text not null default 'pending' check (status in ('pending','approved','denied','cancelled','expired')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.unlock_votes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.unlock_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vote text not null check (vote in ('approve','deny')),
  created_at timestamptz not null default now(),
  unique(request_id,user_id)
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  lithic_card_token uuid not null unique,
  last_four text,
  state text,
  spend_limit_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.card_transactions (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  card_id uuid references public.cards(id) on delete set null,
  lithic_transaction_token uuid unique,
  merchant text,
  amount_cents bigint not null default 0,
  status text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fund_members_user_idx on public.fund_members(user_id,status);
create index if not exists fund_members_fund_idx on public.fund_members(fund_id,status);
create index if not exists ledger_fund_created_idx on public.ledger_entries(fund_id,created_at desc);
create index if not exists unlock_fund_created_idx on public.unlock_requests(fund_id,created_at desc);
create index if not exists cards_fund_user_idx on public.cards(fund_id,user_id);

create or replace function public.is_fund_member(p_fund_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.fund_members where fund_id=p_fund_id and user_id=p_user_id and status='active');
$$;

create or replace function public.is_fund_owner(p_fund_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.fund_members where fund_id=p_fund_id and user_id=p_user_id and role='owner' and status='active');
$$;

grant execute on function public.is_fund_member(uuid,uuid) to authenticated;
grant execute on function public.is_fund_owner(uuid,uuid) to authenticated;

create or replace function public.create_fund_with_owner(
  p_name text,p_emoji text,p_category text,p_goal_cents bigint,p_goal_date date,p_spending_mode text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.profiles(id,display_name)
  values(auth.uid(),coalesce((select raw_user_meta_data->>'full_name' from auth.users where id=auth.uid()),split_part((select email from auth.users where id=auth.uid()),'@',1),'Saver'))
  on conflict(id) do nothing;
  insert into public.funds(owner_id,name,emoji,category,goal_cents,goal_date,spending_mode)
  values(auth.uid(),trim(p_name),coalesce(nullif(p_emoji,''),'💸'),coalesce(nullif(p_category,''),'Other'),p_goal_cents,p_goal_date,p_spending_mode)
  returning id into v_id;
  insert into public.fund_members(fund_id,user_id,role,share_cents,spend_limit_cents)
  values(v_id,auth.uid(),'owner',p_goal_cents,p_goal_cents);
  return v_id;
end $$;
grant execute on function public.create_fund_with_owner(text,text,text,bigint,date,text) to authenticated;

create or replace function public.join_fund_by_code(p_code text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_fund public.funds; v_count int; v_share bigint;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_fund from public.funds where invite_code=upper(trim(p_code)) and status='active';
  if v_fund.id is null then raise exception 'Invite code not found'; end if;
  select count(*) into v_count from public.fund_members where fund_id=v_fund.id and status='active';
  v_share := floor(v_fund.goal_cents / greatest(1,v_count+1));
  insert into public.fund_members(fund_id,user_id,role,share_cents,spend_limit_cents,status)
  values(v_fund.id,auth.uid(),'member',v_share,v_share,'active')
  on conflict(fund_id,user_id) do update set status='active',share_cents=excluded.share_cents,spend_limit_cents=excluded.spend_limit_cents;
  update public.fund_members set share_cents=v_share,spend_limit_cents=v_share where fund_id=v_fund.id and status='active';
  return v_fund.id;
end $$;
grant execute on function public.join_fund_by_code(text) to authenticated;

create or replace function public.post_demo_contribution(p_fund_id uuid,p_amount_cents bigint)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_amount_cents <= 0 then raise exception 'Amount must be positive'; end if;
  if not public.is_fund_member(p_fund_id,auth.uid()) then raise exception 'Not a fund member'; end if;
  insert into public.ledger_entries(fund_id,user_id,entry_type,amount_cents,description,provider)
  values(p_fund_id,auth.uid(),'contribution',p_amount_cents,'Sandbox contribution','demo');
  update public.funds set current_balance_cents=current_balance_cents+p_amount_cents,updated_at=now() where id=p_fund_id;
end $$;
grant execute on function public.post_demo_contribution(uuid,bigint) to authenticated;

create or replace function public.vote_on_unlock(p_request_id uuid,p_vote text)
returns void language plpgsql security definer set search_path=public as $$
declare r public.unlock_requests; member_count int; approvals int; denials int; owner_approved boolean;
begin
  if p_vote not in ('approve','deny') then raise exception 'Invalid vote'; end if;
  select * into r from public.unlock_requests where id=p_request_id and status='pending' for update;
  if r.id is null then raise exception 'Request not pending'; end if;
  if not public.is_fund_member(r.fund_id,auth.uid()) then raise exception 'Not a fund member'; end if;
  insert into public.unlock_votes(request_id,user_id,vote) values(p_request_id,auth.uid(),p_vote)
  on conflict(request_id,user_id) do update set vote=excluded.vote,created_at=now();
  select count(*) into member_count from public.fund_members where fund_id=r.fund_id and status='active';
  select count(*) filter(where vote='approve'),count(*) filter(where vote='deny') into approvals,denials from public.unlock_votes where request_id=p_request_id;
  select exists(select 1 from public.unlock_votes v join public.fund_members fm on fm.user_id=v.user_id and fm.fund_id=r.fund_id where v.request_id=p_request_id and v.vote='approve' and fm.role='owner') into owner_approved;
  if (r.approval_mode='majority' and approvals > member_count/2)
     or (r.approval_mode='unanimous' and approvals >= member_count)
     or (r.approval_mode='owner' and owner_approved) then
    update public.unlock_requests set status='approved',resolved_at=now() where id=p_request_id;
    update public.fund_members set spend_limit_cents=coalesce(spend_limit_cents,share_cents)+r.amount_cents where fund_id=r.fund_id and user_id=r.requester_id;
  elsif (r.approval_mode='unanimous' and denials>0)
     or (r.approval_mode='majority' and denials>=ceil(member_count/2.0)) then
    update public.unlock_requests set status='denied',resolved_at=now() where id=p_request_id;
  end if;
end $$;
grant execute on function public.vote_on_unlock(uuid,text) to authenticated;

alter table public.profiles enable row level security;
alter table public.funds enable row level security;
alter table public.fund_members enable row level security;
alter table public.contribution_plans enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.unlock_requests enable row level security;
alter table public.unlock_votes enable row level security;
alter table public.cards enable row level security;
alter table public.card_transactions enable row level security;

-- Profiles
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "profile insert self" on public.profiles for insert to authenticated with check (id=auth.uid());
create policy "profile update self" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

-- Funds
create policy "members read funds" on public.funds for select to authenticated using (public.is_fund_member(id));
create policy "owners update funds" on public.funds for update to authenticated using (public.is_fund_owner(id)) with check (public.is_fund_owner(id));

-- Memberships
create policy "members read memberships" on public.fund_members for select to authenticated using (public.is_fund_member(fund_id));
create policy "owners manage memberships" on public.fund_members for update to authenticated using (public.is_fund_owner(fund_id)) with check (public.is_fund_owner(fund_id));

-- Contribution plans
create policy "members read contribution plans" on public.contribution_plans for select to authenticated using (public.is_fund_member(fund_id));
create policy "users manage own contribution plans" on public.contribution_plans for all to authenticated using (user_id=auth.uid() and public.is_fund_member(fund_id)) with check (user_id=auth.uid() and public.is_fund_member(fund_id));

-- Ledger (writes go through trusted RPC/Edge Functions)
create policy "members read ledger" on public.ledger_entries for select to authenticated using (public.is_fund_member(fund_id));

-- Unlocks
create policy "members read unlock requests" on public.unlock_requests for select to authenticated using (public.is_fund_member(fund_id));
create policy "members create unlock requests" on public.unlock_requests for insert to authenticated with check (requester_id=auth.uid() and public.is_fund_member(fund_id));
create policy "members read votes" on public.unlock_votes for select to authenticated using (exists(select 1 from public.unlock_requests r where r.id=request_id and public.is_fund_member(r.fund_id)));

-- Cards/transactions: metadata only, never PAN/CVV
create policy "users read own cards" on public.cards for select to authenticated using (user_id=auth.uid() and public.is_fund_member(fund_id));
create policy "members read card transactions" on public.card_transactions for select to authenticated using (public.is_fund_member(fund_id));

-- Realtime publications. Ignore duplicate-object errors if already added.
do $$ begin alter publication supabase_realtime add table public.funds; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.fund_members; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.ledger_entries; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.unlock_requests; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.unlock_votes; exception when duplicate_object then null; end $$;
