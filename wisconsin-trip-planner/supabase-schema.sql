-- Connection Quest Engine v4 storage-efficient Supabase schema
create table if not exists cq_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists cq_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  partner_id uuid references auth.users(id) on delete set null,
  invite_code text unique default encode(gen_random_bytes(8),'hex'),
  status text default 'open',
  created_at timestamptz default now()
);
create table if not exists cq_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer default 0,
  level integer default 1,
  completed_areas text[] default '{}',
  unlocked_achievements text[] default '{}',
  updated_at timestamptz default now()
);
create table if not exists cq_answers (
  user_id uuid references auth.users(id) on delete cascade,
  connection_id uuid references cq_connections(id) on delete cascade,
  question_id text not null,
  answer_value text not null check (char_length(answer_value) <= 320),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key(user_id, connection_id, question_id)
);
create table if not exists cq_secret_answers (
  user_id uuid references auth.users(id) on delete cascade,
  secret_id text not null,
  answer_value text not null check (char_length(answer_value) <= 280),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key(user_id, secret_id)
);
alter table cq_profiles enable row level security;
alter table cq_connections enable row level security;
alter table cq_progress enable row level security;
alter table cq_answers enable row level security;
alter table cq_secret_answers enable row level security;
create policy if not exists "profiles own" on cq_profiles for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy if not exists "progress own" on cq_progress for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy if not exists "secret own" on cq_secret_answers for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy if not exists "connection members" on cq_connections for all using (auth.uid()=owner_id or auth.uid()=partner_id) with check (auth.uid()=owner_id or auth.uid()=partner_id or partner_id is null);
create policy if not exists "answers own" on cq_answers for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
