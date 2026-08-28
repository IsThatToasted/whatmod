create extension if not exists pgcrypto;

create type public.member_role as enum ('owner','admin','estimator','pm','foreman','crew','office','client');
create type public.project_status as enum ('lead','estimating','scheduled','active','paused','complete','archived');
create type public.trade_type as enum ('painting','general','drywall','flooring','roofing','other');
create type public.estimate_status as enum ('draft','review','sent','viewed','accepted','declined','expired');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'crew',
  display_name text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  address_line1 text,
  city text,
  region text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  status public.project_status not null default 'lead',
  primary_trade public.trade_type not null default 'painting',
  description text,
  start_date date,
  target_end_date date,
  budget_cents bigint check (budget_cents is null or budget_cents >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_org_status_idx on public.projects(organization_id,status);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'crew',
  created_at timestamptz not null default now(),
  primary key(project_id,user_id)
);

create table public.production_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trade public.trade_type not null default 'painting',
  code text not null,
  name text not null,
  unit text not null check(unit in ('sqft','lnft','each','hour','day')),
  labor_units_per_hour numeric(12,4) check(labor_units_per_hour is null or labor_units_per_hour > 0),
  material_cost_per_unit_cents integer check(material_cost_per_unit_cents is null or material_cost_per_unit_cents >= 0),
  sell_price_per_unit_cents integer check(sell_price_per_unit_cents is null or sell_price_per_unit_cents >= 0),
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,code)
);

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  status public.estimate_status not null default 'draft',
  title text not null,
  summary text,
  subtotal_cents bigint not null default 0 check(subtotal_cents >= 0),
  tax_cents bigint not null default 0 check(tax_cents >= 0),
  total_cents bigint generated always as (subtotal_cents + tax_cents) stored,
  expires_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index estimates_org_status_idx on public.estimates(organization_id,status);

create table public.estimate_rooms (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  name text not null,
  width_ft numeric(10,3), length_ft numeric(10,3), height_ft numeric(10,3),
  capture_source text not null default 'manual' check(capture_source in ('manual','roomplan','import')),
  confidence numeric(4,3) check(confidence is null or (confidence >= 0 and confidence <= 1)),
  roomplan_payload jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.estimate_surfaces (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.estimate_rooms(id) on delete cascade,
  kind text not null,
  quantity numeric(14,3) not null check(quantity >= 0),
  unit text not null check(unit in ('sqft','lnft','each')),
  condition text not null default 'good' check(condition in ('good','prep','repair')),
  confidence numeric(4,3) check(confidence is null or (confidence >= 0 and confidence <= 1)),
  source text not null default 'manual' check(source in ('manual','roomplan','ai','derived')),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  room_id uuid references public.estimate_rooms(id) on delete set null,
  production_rate_id uuid references public.production_rates(id) on delete set null,
  name text not null,
  description text,
  quantity numeric(14,3) not null default 1 check(quantity >= 0),
  unit text not null,
  unit_price_cents integer not null default 0 check(unit_price_cents >= 0),
  labor_hours numeric(12,3) check(labor_hours is null or labor_hours >= 0),
  material_cost_cents integer check(material_cost_cents is null or material_cost_cents >= 0),
  optional boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.walkthrough_notes (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  room_id uuid references public.estimate_rooms(id) on delete set null,
  captured_by uuid not null references auth.users(id) on delete restrict,
  captured_at timestamptz not null default now(),
  transcript text not null,
  audio_storage_path text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.project_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  room_id uuid references public.estimate_rooms(id) on delete set null,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  storage_path text not null unique,
  thumb_path text,
  mime_type text not null,
  caption text,
  captured_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  status text not null default 'open' check(status in ('open','in_progress','blocked','done','cancelled')),
  priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  clock_in timestamptz not null,
  clock_out timestamptz,
  cost_code text,
  notes text,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check(clock_out is null or clock_out >= clock_in)
);

create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  log_date date not null,
  author_id uuid not null references auth.users(id) on delete restrict,
  weather jsonb,
  manpower jsonb,
  work_completed text,
  blockers text,
  safety_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,log_date,author_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  body text not null check(length(body) between 1 and 8000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index messages_project_created_idx on public.messages(project_id,created_at desc);

create or replace function public.is_org_member(org_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.organization_members m where m.organization_id=org_id and m.user_id=auth.uid() and m.active=true);
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.organization_members m where m.organization_id=org_id and m.user_id=auth.uid() and m.active=true and m.role in ('owner','admin'));
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.production_rates enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_rooms enable row level security;
alter table public.estimate_surfaces enable row level security;
alter table public.estimate_line_items enable row level security;
alter table public.walkthrough_notes enable row level security;
alter table public.project_media enable row level security;
alter table public.tasks enable row level security;
alter table public.time_entries enable row level security;
alter table public.daily_logs enable row level security;
alter table public.messages enable row level security;

create policy org_select on public.organizations for select using(public.is_org_member(id));
create policy org_insert on public.organizations for insert with check(auth.uid()=created_by);
create policy org_update on public.organizations for update using(public.is_org_admin(id));
create policy member_select on public.organization_members for select using(public.is_org_member(organization_id));
create policy member_admin_all on public.organization_members for all using(public.is_org_admin(organization_id)) with check(public.is_org_admin(organization_id));

create policy clients_member_all on public.clients for all using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
create policy projects_member_all on public.projects for all using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
create policy rates_member_select on public.production_rates for select using(public.is_org_member(organization_id));
create policy rates_admin_write on public.production_rates for all using(public.is_org_admin(organization_id)) with check(public.is_org_admin(organization_id));
create policy estimates_member_all on public.estimates for all using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
create policy media_member_all on public.project_media for all using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
create policy tasks_member_all on public.tasks for all using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
create policy time_member_select on public.time_entries for select using(public.is_org_member(organization_id));
create policy time_self_insert on public.time_entries for insert with check(public.is_org_member(organization_id) and user_id=auth.uid());
create policy time_self_update on public.time_entries for update using(user_id=auth.uid() or public.is_org_admin(organization_id));
create policy logs_member_all on public.daily_logs for all using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
create policy messages_member_all on public.messages for all using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));

create policy project_members_select on public.project_members for select using(exists(select 1 from public.projects p where p.id=project_id and public.is_org_member(p.organization_id)));
create policy project_members_admin on public.project_members for all using(exists(select 1 from public.projects p where p.id=project_id and public.is_org_admin(p.organization_id))) with check(exists(select 1 from public.projects p where p.id=project_id and public.is_org_admin(p.organization_id)));
create policy rooms_estimate_access on public.estimate_rooms for all using(exists(select 1 from public.estimates e where e.id=estimate_id and public.is_org_member(e.organization_id))) with check(exists(select 1 from public.estimates e where e.id=estimate_id and public.is_org_member(e.organization_id)));
create policy surfaces_estimate_access on public.estimate_surfaces for all using(exists(select 1 from public.estimate_rooms r join public.estimates e on e.id=r.estimate_id where r.id=room_id and public.is_org_member(e.organization_id))) with check(exists(select 1 from public.estimate_rooms r join public.estimates e on e.id=r.estimate_id where r.id=room_id and public.is_org_member(e.organization_id)));
create policy lines_estimate_access on public.estimate_line_items for all using(exists(select 1 from public.estimates e where e.id=estimate_id and public.is_org_member(e.organization_id))) with check(exists(select 1 from public.estimates e where e.id=estimate_id and public.is_org_member(e.organization_id)));
create policy notes_estimate_access on public.walkthrough_notes for all using(exists(select 1 from public.estimates e where e.id=estimate_id and public.is_org_member(e.organization_id))) with check(exists(select 1 from public.estimates e where e.id=estimate_id and public.is_org_member(e.organization_id)));

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger org_touch before update on public.organizations for each row execute function public.touch_updated_at();
create trigger client_touch before update on public.clients for each row execute function public.touch_updated_at();
create trigger project_touch before update on public.projects for each row execute function public.touch_updated_at();
create trigger rate_touch before update on public.production_rates for each row execute function public.touch_updated_at();
create trigger estimate_touch before update on public.estimates for each row execute function public.touch_updated_at();
create trigger task_touch before update on public.tasks for each row execute function public.touch_updated_at();
create trigger log_touch before update on public.daily_logs for each row execute function public.touch_updated_at();
