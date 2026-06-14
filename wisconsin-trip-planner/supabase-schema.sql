create table if not exists public.trip_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  plan jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(user_id, plan_id)
);

alter table public.trip_plans enable row level security;

create policy "Users can read their own trip plans"
on public.trip_plans for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own trip plans"
on public.trip_plans for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own trip plans"
on public.trip_plans for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
