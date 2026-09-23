-- JustGlance v2.3.1 — FIXED Smart shopping links + browser extension bridge
-- Additive / migration-safe. Does not delete existing items, lists, members, invites, or captures.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
-- Supabase normally keeps pgcrypto in the extensions schema. Qualify its functions explicitly below.


-- Rich product metadata. The base public.items row remains canonical.
alter table if exists public.shopping_items
  add column if not exists source_url text,
  add column if not exists image_url text,
  add column if not exists currency text,
  add column if not exists product_id text,
  add column if not exists product_metadata jsonb not null default '{}'::jsonb;

create index if not exists shopping_items_source_url_idx
  on public.shopping_items(source_url)
  where source_url is not null;

-- Revocable, shopping-only browser integration credentials.
-- Only a SHA-256 hash is stored. The raw token is returned once when created.
create table if not exists public.browser_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Chrome',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists browser_integrations_user_idx
  on public.browser_integrations(user_id, revoked_at, created_at desc);

alter table public.browser_integrations enable row level security;

drop policy if exists browser_integrations_select_self on public.browser_integrations;
create policy browser_integrations_select_self
  on public.browser_integrations for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists browser_integrations_insert_self on public.browser_integrations;
create policy browser_integrations_insert_self
  on public.browser_integrations for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists browser_integrations_update_self on public.browser_integrations;
create policy browser_integrations_update_self
  on public.browser_integrations for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists browser_integrations_delete_self on public.browser_integrations;
create policy browser_integrations_delete_self
  on public.browser_integrations for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.browser_integrations to authenticated;

-- Create a revocable browser token. This token is NOT a Supabase access token and
-- can only be used with the narrowly-scoped browser RPCs below.
create or replace function public.create_browser_integration(p_name text default 'Chrome')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_token text;
  hashed text;
  integration_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  raw_token := 'jgext_' || encode(extensions.gen_random_bytes(32), 'hex');
  hashed := encode(extensions.digest(convert_to(raw_token, 'UTF8'), 'sha256'::text), 'hex');

  insert into public.browser_integrations(user_id, name, token_hash)
  values(auth.uid(), coalesce(nullif(trim(p_name), ''), 'Chrome'), hashed)
  returning id into integration_id;

  return jsonb_build_object(
    'id', integration_id,
    'token', raw_token,
    'name', coalesce(nullif(trim(p_name), ''), 'Chrome')
  );
end $$;

revoke all on function public.create_browser_integration(text) from public;
grant execute on function public.create_browser_integration(text) to authenticated;

create or replace function public.revoke_browser_integration(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.browser_integrations
  set revoked_at = now()
  where id = p_id and user_id = auth.uid() and revoked_at is null;
end $$;

revoke all on function public.revoke_browser_integration(uuid) from public;
grant execute on function public.revoke_browser_integration(uuid) to authenticated;

-- Internal helper: resolve a raw browser token to its owner.
create or replace function public.browser_integration_user(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select bi.user_id
  from public.browser_integrations bi
  where bi.token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'::text), 'hex')
    and bi.revoked_at is null
  limit 1
$$;

revoke all on function public.browser_integration_user(text) from public;

-- Internal helper: browser integrations may only write shopping data in spaces
-- where the token owner currently has edit-shopping access.
create or replace function public.browser_can_edit_shopping(p_user uuid, p_space uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.space_members m
    where m.user_id = p_user
      and m.space_id = p_space
      and (
        m.role in ('owner','admin')
        or coalesce((m.permissions ->> 'edit_shopping')::boolean, true)
      )
  )
$$;

revoke all on function public.browser_can_edit_shopping(uuid,uuid) from public;

-- Two-way list sync used by the Chrome extension. Includes a synthetic General
-- destination (list_id = null) for every editable space.
create or replace function public.browser_get_shopping_lists(p_token text)
returns table(
  space_id uuid,
  space_name text,
  list_id uuid,
  list_name text,
  list_icon text,
  sort_order numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  token_user uuid;
begin
  token_user := public.browser_integration_user(p_token);
  if token_user is null then raise exception 'Invalid or revoked JustGlance browser token'; end if;

  update public.browser_integrations
  set last_used_at = now()
  where user_id = token_user
    and token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'::text), 'hex');

  return query
  select s.id, s.name, sl.id, sl.name, sl.icon, sl.sort_order
  from public.spaces s
  join public.space_members m on m.space_id = s.id and m.user_id = token_user
  join public.shopping_lists sl on sl.space_id = s.id and sl.archived_at is null
  where public.browser_can_edit_shopping(token_user, s.id)

  union all

  select s.id, s.name, null::uuid, 'General'::text, 'basket'::text, 999999::numeric
  from public.spaces s
  join public.space_members m on m.space_id = s.id and m.user_id = token_user
  where public.browser_can_edit_shopping(token_user, s.id)

  order by 2, 6, 4;
end $$;

revoke all on function public.browser_get_shopping_lists(text) from public;
grant execute on function public.browser_get_shopping_lists(text) to anon, authenticated;

-- Shopping-only write endpoint for the extension. It cannot create arbitrary
-- notes/tasks/events and it rechecks current space permissions on every write.
create or replace function public.browser_add_shopping_item(
  p_token text,
  p_space uuid,
  p_list uuid default null,
  p_title text default null,
  p_url text default null,
  p_image_url text default null,
  p_price numeric default null,
  p_currency text default 'USD',
  p_store text default null,
  p_category text default null,
  p_product_id text default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  token_user uuid;
  new_item uuid;
  clean_title text;
begin
  token_user := public.browser_integration_user(p_token);
  if token_user is null then raise exception 'Invalid or revoked JustGlance browser token'; end if;
  if not public.browser_can_edit_shopping(token_user, p_space) then raise exception 'Shopping access is no longer available for that space'; end if;

  if p_list is not null and not exists(
    select 1 from public.shopping_lists sl
    where sl.id = p_list and sl.space_id = p_space and sl.archived_at is null
  ) then
    raise exception 'Shopping list does not belong to that space';
  end if;

  clean_title := nullif(trim(coalesce(p_title, '')), '');
  if clean_title is null then clean_title := coalesce(nullif(trim(p_store), ''), 'Saved product'); end if;

  insert into public.items(
    user_id, space_id, title, description, type, status, priority,
    context_tags, source_text, parser_result
  ) values (
    token_user, p_space, left(clean_title, 500), nullif(trim(p_notes), ''),
    'shopping', 'open', 'normal',
    array['product-link','browser-extension'], p_url,
    jsonb_build_object('source','browser-extension','url',p_url,'store',p_store,'category',p_category)
  ) returning id into new_item;

  insert into public.shopping_items(
    item_id, quantity, preferred_store, estimated_price, aisle_category,
    list_id, source_url, image_url, currency, product_id, product_metadata
  ) values (
    new_item, 1, nullif(trim(p_store), ''), p_price, nullif(trim(p_category), ''),
    p_list, nullif(trim(p_url), ''), nullif(trim(p_image_url), ''),
    nullif(upper(trim(coalesce(p_currency, ''))), ''), nullif(trim(p_product_id), ''), coalesce(p_metadata, '{}'::jsonb)
  );

  update public.browser_integrations
  set last_used_at = now()
  where user_id = token_user
    and token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'::text), 'hex');

  return jsonb_build_object('item_id', new_item, 'space_id', p_space, 'list_id', p_list, 'title', clean_title);
end $$;

revoke all on function public.browser_add_shopping_item(text,uuid,uuid,text,text,text,numeric,text,text,text,text,text,jsonb) from public;
grant execute on function public.browser_add_shopping_item(text,uuid,uuid,text,text,text,numeric,text,text,text,text,text,jsonb) to anon, authenticated;

-- Realtime already publishes shopping_items/shopping_lists in migration 003.
-- Force PostgREST to notice new columns/functions immediately.
notify pgrst, 'reload schema';

-- Final diagnostic result.
select
  to_regclass('public.browser_integrations') is not null as browser_integrations_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='shopping_items' and column_name='source_url') as product_links_ready,
  to_regprocedure('public.create_browser_integration(text)') is not null as pairing_rpc_ready,
  to_regprocedure('public.browser_get_shopping_lists(text)') is not null as list_rpc_ready,
  to_regprocedure('public.browser_add_shopping_item(text,uuid,uuid,text,text,text,numeric,text,text,text,text,text,jsonb)') is not null as add_rpc_ready;
