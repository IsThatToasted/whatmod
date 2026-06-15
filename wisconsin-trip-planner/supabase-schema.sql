create table if not exists public.bondquest_apps (
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, app_id)
);

alter table public.bondquest_apps enable row level security;

drop policy if exists "Users can read their own BondQuest saves" on public.bondquest_apps;
drop policy if exists "Users can insert their own BondQuest saves" on public.bondquest_apps;
drop policy if exists "Users can update their own BondQuest saves" on public.bondquest_apps;
drop policy if exists "Users can delete their own BondQuest saves" on public.bondquest_apps;

create policy "Users can read their own BondQuest saves"
on public.bondquest_apps for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own BondQuest saves"
on public.bondquest_apps for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own BondQuest saves"
on public.bondquest_apps for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own BondQuest saves"
on public.bondquest_apps for delete
to authenticated
using (auth.uid() = user_id);
