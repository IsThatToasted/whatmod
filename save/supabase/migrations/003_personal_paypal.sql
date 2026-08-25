-- SAVE Personal Mode / PayPal contribution + source-refund migration
-- Additive: does not remove Lithic sandbox/card infrastructure.

drop index if exists public.ledger_provider_reference_unique;
create unique index if not exists ledger_provider_reference_unique on public.ledger_entries(provider,provider_reference);

create table if not exists public.personal_payment_settings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'paypal' check (provider in ('paypal')),
  settlement_label text not null default 'Save settlement bank',
  settlement_last_four text,
  mode text not null default 'sandbox' check (mode in ('sandbox','live')),
  configured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id,provider)
);

create table if not exists public.card_contributions (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null default 'paypal',
  provider_order_id text not null,
  provider_capture_id text,
  amount_cents bigint not null check (amount_cents > 0),
  refunded_cents bigint not null default 0 check (refunded_cents >= 0),
  refund_reserved_cents bigint not null default 0 check (refund_reserved_cents >= 0),
  currency text not null default 'USD',
  status text not null default 'initiated' check (status in ('initiated','approved','processing','settled','failed','cancelled','reversed','partially_refunded','refunded')),
  source_type text,
  source_brand text,
  source_last_four text,
  payer_email text,
  idempotency_key uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  settled_at timestamptz,
  unique(provider,provider_order_id),
  unique(provider,provider_capture_id),
  unique(idempotency_key),
  check (refunded_cents + refund_reserved_cents <= amount_cents)
);
create index if not exists card_contributions_fund_user_idx on public.card_contributions(fund_id,user_id,created_at desc);
create index if not exists card_contributions_capture_idx on public.card_contributions(provider_capture_id) where provider_capture_id is not null;

create table if not exists public.source_refunds (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  card_contribution_id uuid not null references public.card_contributions(id) on delete restrict,
  provider text not null default 'paypal',
  provider_refund_id text not null,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending','settled','failed','cancelled')),
  idempotency_key uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  settled_at timestamptz,
  unique(provider,provider_refund_id),
  unique(idempotency_key)
);
create index if not exists source_refunds_fund_user_idx on public.source_refunds(fund_id,user_id,created_at desc);

alter table public.personal_payment_settings enable row level security;
alter table public.card_contributions enable row level security;
alter table public.source_refunds enable row level security;

create policy "owners read own personal payment settings" on public.personal_payment_settings
for select to authenticated using (owner_user_id=auth.uid());

create policy "members read own card contributions" on public.card_contributions
for select to authenticated using (user_id=auth.uid() and public.is_fund_member(fund_id));

create policy "members read own source refunds" on public.source_refunds
for select to authenticated using (user_id=auth.uid() and public.is_fund_member(fund_id));

-- Return only refundable value that can actually be traced to settled card captures.
create or replace function public.user_source_refundable_cents(p_fund_id uuid,p_user_id uuid default auth.uid())
returns bigint language plpgsql stable security definer set search_path=public as $$
declare v_total bigint;
begin
  if auth.uid() is not null and p_user_id <> auth.uid() then raise exception 'Not authorized'; end if;
  if auth.uid() is not null and not public.is_fund_member(p_fund_id,p_user_id) then raise exception 'Not authorized'; end if;
  select least(
    greatest(0,coalesce(sum(amount_cents-refunded_cents-refund_reserved_cents),0))::bigint,
    greatest(0,public.user_refundable_cents(p_fund_id,p_user_id))::bigint
  ) into v_total
  from public.card_contributions
  where fund_id=p_fund_id and user_id=p_user_id
    and status in ('settled','partially_refunded')
    and amount_cents>(refunded_cents+refund_reserved_cents);
  return coalesce(v_total,0);
end $$;
grant execute on function public.user_source_refundable_cents(uuid,uuid) to authenticated;

do $$ begin alter publication supabase_realtime add table public.card_contributions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.source_refunds; exception when duplicate_object then null; end $$;
