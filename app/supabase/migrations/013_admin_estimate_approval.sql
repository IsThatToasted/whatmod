-- v0.13.0: durable estimate review/approval packets for completed walkthrough sets.
-- Safe to run after 012_chat_audience_admin_groups.sql.

create table if not exists public.estimate_review_packets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  revision integer not null default 1,
  status text not null default 'submitted' check(status in ('submitted','in_review','approved','rejected','finalized','sent')),
  title text not null,
  customer_name text,
  customer_email text,
  scope_summary text,
  customer_notes text,
  internal_notes text,
  terms text,
  subtotal_cents bigint not null default 0 check(subtotal_cents >= 0),
  tax_cents bigint not null default 0 check(tax_cents >= 0),
  total_cents bigint generated always as (subtotal_cents + tax_cents) stored,
  total_labor_hours numeric(12,3) not null default 0,
  walkthrough_count integer not null default 0,
  walkthrough_snapshot jsonb not null default '[]'::jsonb,
  line_item_snapshot jsonb not null default '[]'::jsonb,
  evidence_snapshot jsonb not null default '[]'::jsonb,
  proposal_snapshot jsonb,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,
  finalized_by uuid references auth.users(id) on delete set null,
  finalized_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, revision)
);
create index if not exists estimate_review_packets_org_status_idx on public.estimate_review_packets(organization_id,status,submitted_at desc);
create index if not exists estimate_review_packets_project_idx on public.estimate_review_packets(project_id,revision desc);
alter table public.estimate_review_packets enable row level security;

drop policy if exists estimate_review_packets_member_select on public.estimate_review_packets;
create policy estimate_review_packets_member_select on public.estimate_review_packets for select
using (public.is_org_member(organization_id));
drop policy if exists estimate_review_packets_admin_write on public.estimate_review_packets;
create policy estimate_review_packets_admin_write on public.estimate_review_packets for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

grant select on public.estimate_review_packets to authenticated;
grant insert, update, delete on public.estimate_review_packets to authenticated;

-- Replace the completion RPC without changing its signature. Completion now archives scans
-- AND creates a durable review packet for Admin > Estimates.
create or replace function public.complete_project_walkthrough(target_project_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path=public
as $$
declare
  project_org uuid;
  project_name text;
  project_client text;
  completed_at timestamptz := now();
  next_revision integer;
  packet_id uuid;
  snapshot jsonb;
  line_snapshot jsonb;
  evidence jsonb;
  labor_total numeric := 0;
  scan_count integer := 0;
begin
  select organization_id,name,client_name into project_org,project_name,project_client
  from public.projects where id=target_project_id;
  if project_org is null then raise exception 'Project not found'; end if;
  if not public.is_org_member(project_org) then raise exception 'Organization membership required'; end if;
  if not exists(select 1 from public.walkthrough_scans where project_id=target_project_id) then
    raise exception 'This project has no walkthrough rooms to complete';
  end if;

  update public.walkthrough_scans
  set archived_at=coalesce(archived_at,completed_at)
  where project_id=target_project_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ws.id,
    'estimate_id', ws.estimate_id,
    'room_id', ws.room_id,
    'room_name', coalesce(ws.room_name,'Room'),
    'captured_by', ws.captured_by,
    'captured_at', ws.captured_at,
    'wall_count', ws.wall_count,
    'door_count', ws.door_count,
    'window_count', ws.window_count,
    'wall_gross_sqft', ws.wall_gross_sqft,
    'openings_sqft', ws.openings_sqft,
    'paintable_wall_sqft', ws.paintable_wall_sqft,
    'average_wall_height_ft', ws.average_wall_height_ft,
    'wall_linear_ft', ws.wall_linear_ft,
    'measurements_confirmed', ws.measurements_confirmed,
    'scope_lines', coalesce(ws.scope_lines,'[]'::jsonb),
    'estimate_notes', ws.estimate_notes,
    'transcript', ws.transcript,
    'video_storage_path', ws.video_storage_path,
    'usdz_storage_path', ws.usdz_storage_path,
    'roomplan_storage_path', ws.roomplan_storage_path,
    'archived_at', ws.archived_at
  ) order by ws.captured_at), '[]'::jsonb), count(*)
  into snapshot, scan_count
  from public.walkthrough_scans ws where ws.project_id=target_project_id;

  -- Prefer the latest editable walkthrough scope snapshot. This reflects post-scan edits
  -- (doors/windows toggled back on, corrected quantities/rates, etc.) rather than stale line items.
  select coalesce(jsonb_agg(jsonb_build_object(
    'estimate_id',ws.estimate_id,'room_id',ws.room_id,'walkthrough_id',ws.id,
    'name',line->>'kind','description','Submitted walkthrough scope',
    'quantity',coalesce((line->>'quantity')::numeric,0),'unit',coalesce(line->>'unit',''),
    'unit_price_cents',0,'labor_hours',coalesce((line->>'laborHours')::numeric,0),
    'material_cost_cents',null,'optional',false
  ) order by ws.captured_at), '[]'::jsonb), coalesce(sum(coalesce((line->>'laborHours')::numeric,0)),0)
  into line_snapshot, labor_total
  from public.walkthrough_scans ws
  cross join lateral jsonb_array_elements(coalesce(ws.scope_lines,'[]'::jsonb)) line
  where ws.project_id=target_project_id and coalesce((line->>'enabled')::boolean,false);

  -- Legacy walkthroughs created before editable scope snapshots fall back to original estimate lines.
  if jsonb_array_length(line_snapshot)=0 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'estimate_id', eli.estimate_id,'room_id', eli.room_id,'name', eli.name,'description', eli.description,
      'quantity', eli.quantity,'unit', eli.unit,'unit_price_cents', eli.unit_price_cents,
      'labor_hours', eli.labor_hours,'material_cost_cents', eli.material_cost_cents,'optional', eli.optional
    ) order by eli.created_at), '[]'::jsonb), coalesce(sum(eli.labor_hours),0)
    into line_snapshot, labor_total
    from public.estimate_line_items eli join public.estimates e on e.id=eli.estimate_id
    where e.project_id=target_project_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',pm.id,'walkthrough_id',pm.walkthrough_id,'room_id',pm.room_id,'storage_path',pm.storage_path,
    'mime_type',pm.mime_type,'captured_at',pm.captured_at,'evidence_tag',pm.evidence_tag
  ) order by pm.captured_at),'[]'::jsonb)
  into evidence from public.project_media pm where pm.project_id=target_project_id and pm.walkthrough_id is not null;

  -- Avoid generating duplicate packets from repeated taps for the same completed set.
  select id into packet_id from public.estimate_review_packets
  where project_id=target_project_id and status in ('submitted','in_review')
  order by revision desc limit 1;

  if packet_id is null then
    select coalesce(max(revision),0)+1 into next_revision
    from public.estimate_review_packets where project_id=target_project_id;

    insert into public.estimate_review_packets(
      organization_id,project_id,revision,status,title,customer_name,total_labor_hours,
      walkthrough_count,walkthrough_snapshot,line_item_snapshot,evidence_snapshot,submitted_by,submitted_at
    ) values (
      project_org,target_project_id,next_revision,'submitted',project_name || ' Proposal',project_client,
      labor_total,scan_count,snapshot,line_snapshot,evidence,auth.uid(),completed_at
    );
  else
    update public.estimate_review_packets set
      walkthrough_snapshot=snapshot,
      line_item_snapshot=line_snapshot,
      evidence_snapshot=evidence,
      total_labor_hours=labor_total,
      walkthrough_count=scan_count,
      submitted_at=completed_at,
      updated_at=completed_at
    where id=packet_id;
  end if;

  update public.estimates set status='review',updated_at=completed_at
  where project_id=target_project_id and status='draft';

  update public.projects
  set walkthrough_completed_at=completed_at, updated_at=completed_at
  where id=target_project_id;

  return completed_at;
end;
$$;
grant execute on function public.complete_project_walkthrough(uuid) to authenticated;

create or replace function public.admin_set_estimate_review_state(
  packet_id uuid,
  new_status text,
  review_note text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare p public.estimate_review_packets%rowtype;
begin
  select * into p from public.estimate_review_packets where id=packet_id;
  if p.id is null then raise exception 'Estimate packet not found'; end if;
  if not public.is_org_admin(p.organization_id) then raise exception 'Organization admin required'; end if;
  if new_status not in ('in_review','approved','rejected') then raise exception 'Invalid review status'; end if;

  update public.estimate_review_packets set
    status=new_status,
    internal_notes=case when review_note is null then internal_notes else review_note end,
    reviewed_by=auth.uid(), reviewed_at=now(),
    approved_by=case when new_status='approved' then auth.uid() else approved_by end,
    approved_at=case when new_status='approved' then now() else approved_at end,
    rejected_by=case when new_status='rejected' then auth.uid() else null end,
    rejected_at=case when new_status='rejected' then now() else null end,
    rejection_reason=case when new_status='rejected' then review_note else null end,
    updated_at=now()
  where id=packet_id;

  if new_status='approved' then
    update public.estimates set status='review',updated_at=now() where project_id=p.project_id;
  end if;
end;
$$;
grant execute on function public.admin_set_estimate_review_state(uuid,text,text) to authenticated;

create or replace function public.admin_finalize_estimate_packet(
  packet_id uuid,
  proposal_title text,
  proposal_customer_name text,
  proposal_customer_email text default null,
  proposal_scope_summary text default null,
  proposal_customer_notes text default null,
  proposal_terms text default null,
  proposal_subtotal_cents bigint default 0,
  proposal_tax_cents bigint default 0
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare p public.estimate_review_packets%rowtype;
declare proposal jsonb;
begin
  select * into p from public.estimate_review_packets where id=packet_id;
  if p.id is null then raise exception 'Estimate packet not found'; end if;
  if not public.is_org_admin(p.organization_id) then raise exception 'Organization admin required'; end if;
  if p.status not in ('approved','finalized') then raise exception 'Approve the estimate before finalizing'; end if;

  proposal := jsonb_build_object(
    'packet_id',p.id,'project_id',p.project_id,'revision',p.revision,
    'title',proposal_title,'customer_name',proposal_customer_name,'customer_email',proposal_customer_email,
    'scope_summary',proposal_scope_summary,'customer_notes',proposal_customer_notes,'terms',proposal_terms,
    'subtotal_cents',greatest(0,proposal_subtotal_cents),'tax_cents',greatest(0,proposal_tax_cents),
    'total_cents',greatest(0,proposal_subtotal_cents)+greatest(0,proposal_tax_cents),
    'total_labor_hours',p.total_labor_hours,'walkthroughs',p.walkthrough_snapshot,
    'line_items',p.line_item_snapshot,'evidence',p.evidence_snapshot,'finalized_at',now(),'finalized_by',auth.uid()
  );

  update public.estimate_review_packets set
    status='finalized',title=proposal_title,customer_name=proposal_customer_name,
    customer_email=proposal_customer_email,scope_summary=proposal_scope_summary,
    customer_notes=proposal_customer_notes,terms=proposal_terms,
    subtotal_cents=greatest(0,proposal_subtotal_cents),tax_cents=greatest(0,proposal_tax_cents),
    proposal_snapshot=proposal,finalized_by=auth.uid(),finalized_at=now(),updated_at=now()
  where id=packet_id;

end;
$$;
grant execute on function public.admin_finalize_estimate_packet(uuid,text,text,text,text,text,text,bigint,bigint) to authenticated;

-- Backfill projects that were completed before v0.13.0 so existing archived walkthroughs
-- immediately become visible in Admin > Estimates. This does not alter the source scans.
insert into public.estimate_review_packets(
  organization_id,project_id,revision,status,title,customer_name,total_labor_hours,
  walkthrough_count,walkthrough_snapshot,line_item_snapshot,evidence_snapshot,submitted_by,submitted_at
)
select
  p.organization_id,
  p.id,
  1,
  'submitted',
  p.name || ' Proposal',
  p.client_name,
  coalesce((select sum(coalesce((line->>'laborHours')::numeric,0)) from public.walkthrough_scans ws cross join lateral jsonb_array_elements(coalesce(ws.scope_lines,'[]'::jsonb)) line where ws.project_id=p.id and coalesce((line->>'enabled')::boolean,false)),(select sum(eli.labor_hours) from public.estimate_line_items eli join public.estimates e on e.id=eli.estimate_id where e.project_id=p.id),0),
  (select count(*) from public.walkthrough_scans ws where ws.project_id=p.id),
  coalesce((select jsonb_agg(jsonb_build_object(
    'id', ws.id,'estimate_id',ws.estimate_id,'room_id',ws.room_id,'room_name',coalesce(ws.room_name,'Room'),
    'captured_by',ws.captured_by,'captured_at',ws.captured_at,'wall_count',ws.wall_count,'door_count',ws.door_count,'window_count',ws.window_count,
    'wall_gross_sqft',ws.wall_gross_sqft,'openings_sqft',ws.openings_sqft,'paintable_wall_sqft',ws.paintable_wall_sqft,
    'average_wall_height_ft',ws.average_wall_height_ft,'wall_linear_ft',ws.wall_linear_ft,'measurements_confirmed',ws.measurements_confirmed,
    'scope_lines',coalesce(ws.scope_lines,'[]'::jsonb),'estimate_notes',ws.estimate_notes,'transcript',ws.transcript,
    'video_storage_path',ws.video_storage_path,'usdz_storage_path',ws.usdz_storage_path,'roomplan_storage_path',ws.roomplan_storage_path,
    'archived_at',ws.archived_at
  ) order by ws.captured_at) from public.walkthrough_scans ws where ws.project_id=p.id),'[]'::jsonb),
  coalesce(
    (select jsonb_agg(jsonb_build_object(
      'estimate_id',ws.estimate_id,'room_id',ws.room_id,'walkthrough_id',ws.id,'name',line->>'kind','description','Submitted walkthrough scope',
      'quantity',coalesce((line->>'quantity')::numeric,0),'unit',coalesce(line->>'unit',''),'unit_price_cents',0,
      'labor_hours',coalesce((line->>'laborHours')::numeric,0),'material_cost_cents',null,'optional',false
    ) order by ws.captured_at) from public.walkthrough_scans ws cross join lateral jsonb_array_elements(coalesce(ws.scope_lines,'[]'::jsonb)) line where ws.project_id=p.id and coalesce((line->>'enabled')::boolean,false)),
    (select jsonb_agg(jsonb_build_object(
      'estimate_id',eli.estimate_id,'room_id',eli.room_id,'name',eli.name,'description',eli.description,'quantity',eli.quantity,'unit',eli.unit,
      'unit_price_cents',eli.unit_price_cents,'labor_hours',eli.labor_hours,'material_cost_cents',eli.material_cost_cents,'optional',eli.optional
    ) order by eli.created_at) from public.estimate_line_items eli join public.estimates e on e.id=eli.estimate_id where e.project_id=p.id),
    '[]'::jsonb
  ),
  coalesce((select jsonb_agg(jsonb_build_object(
    'id',pm.id,'walkthrough_id',pm.walkthrough_id,'room_id',pm.room_id,'storage_path',pm.storage_path,
    'mime_type',pm.mime_type,'captured_at',pm.captured_at,'evidence_tag',pm.evidence_tag
  ) order by pm.captured_at) from public.project_media pm where pm.project_id=p.id and pm.walkthrough_id is not null),'[]'::jsonb),
  (select ws.captured_by from public.walkthrough_scans ws where ws.project_id=p.id order by ws.captured_at desc limit 1),
  coalesce(p.walkthrough_completed_at,(select max(ws.archived_at) from public.walkthrough_scans ws where ws.project_id=p.id),now())
from public.projects p
where exists(select 1 from public.walkthrough_scans ws where ws.project_id=p.id and ws.archived_at is not null)
  and not exists(select 1 from public.estimate_review_packets rp where rp.project_id=p.id)
on conflict(project_id,revision) do nothing;
