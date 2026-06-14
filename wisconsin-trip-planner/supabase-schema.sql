create table if not exists public.trip_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, trip_id)
);

alter table public.trip_plans enable row level security;

drop policy if exists "Users can read their own trip plans" on public.trip_plans;
drop policy if exists "Users can insert their own trip plans" on public.trip_plans;
drop policy if exists "Users can update their own trip plans" on public.trip_plans;
drop policy if exists "Users can delete their own trip plans" on public.trip_plans;

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

create policy "Users can delete their own trip plans"
on public.trip_plans for delete
to authenticated
using (auth.uid() = user_id);
