-- Trivia V20 — Persistent Category Catalog
-- Keeps every player-facing category visible even when it currently has zero questions.
-- Custom categories are auto-registered when questions are inserted/recategorized.
-- Safe to run repeatedly.

create table if not exists public.trivia_category_catalog (
  category text primary key,
  sort_order integer not null default 1000,
  enabled boolean not null default true,
  user_selectable boolean not null default true,
  default_terms text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trivia_category_catalog enable row level security;
revoke all on table public.trivia_category_catalog from anon, authenticated;

insert into public.trivia_category_catalog(category,sort_order,default_terms) values
  ('Brainrot',10,array['Italian brainrot','Tralalero Tralala','Bombardiro Crocodilo','Ballerina Cappuccina','brainrot meme','TikTok meme']),
  ('General Gaming Knowledge',20,array['Minecraft','Fortnite','Roblox','Grand Theft Auto','Call of Duty','Pokémon','Mario','Nintendo','PlayStation','Xbox']),
  ('Internet Culture',30,array['YouTube','TikTok','Twitch','Discord','Reddit','internet meme','viral video']),
  ('Pop Culture',40,array['Marvel','Star Wars','Disney','celebrity','superhero','streaming television']),
  ('Movies & TV',50,array['blockbuster film','television series','animated film','sitcom','movie franchise']),
  ('Music',60,array['pop music','hip hop','rock band','singer','album']),
  ('Food & Brands',70,array['McDonald''s','Coca-Cola','Pepsi','Starbucks','Oreo','Doritos','food brand']),
  ('General Knowledge',80,array['famous landmark','major city','world record','famous person','country']),
  ('Science',90,array['chemistry','physics','biology','chemical element','scientist']),
  ('Technology',100,array['software','operating system','programming language','computer','smartphone']),
  ('History',110,array['historical event','battle','world leader','ancient civilization','historical figure']),
  ('Geography',120,array['country','capital city','river','mountain','island','lake']),
  ('Animals',130,array['mammal','bird','reptile','marine animal','wild animal']),
  ('Space',140,array['planet','moon','space mission','astronaut','exoplanet']),
  ('Sports',150,array['football club','basketball team','stadium','athlete','Olympics']),
  ('Entertainment',160,array['book','author','comic','theme park','board game']),
  ('Business',170,array['company','brand','founder','employee count','retail company'])
on conflict(category) do update set
  sort_order=excluded.sort_order,
  default_terms=excluded.default_terms,
  updated_at=now();

-- Register every historical/custom category already present in the bank.
insert into public.trivia_category_catalog(category,sort_order)
select distinct trim(q.category),1000
from public.questions q
where nullif(trim(q.category),'') is not null
on conflict(category) do nothing;

create or replace function public.register_trivia_category_v20()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if nullif(trim(new.category),'') is not null then
    insert into public.trivia_category_catalog(category,sort_order,updated_at)
    values(trim(new.category),1000,now())
    on conflict(category) do update set updated_at=excluded.updated_at;
  end if;
  return new;
end $$;

drop trigger if exists trg_register_trivia_category_v20 on public.questions;
create trigger trg_register_trivia_category_v20
  after insert or update of category on public.questions
  for each row execute function public.register_trivia_category_v20();

-- Preserve the V16 RPC name so existing clients immediately receive zero-population
-- catalog categories as well as populated/custom categories.
create or replace function public.get_available_categories_v16()
returns table(category text, question_count bigint)
language sql
security definer
set search_path=public
as $$
  with catalog as (
    select c.category,c.sort_order
    from public.trivia_category_catalog c
    where c.enabled=true and c.user_selectable=true
  ), counts as (
    select trim(q.category) as category,count(*)::bigint as question_count
    from public.questions q
    where q.is_active=true and nullif(trim(q.category),'') is not null
    group by trim(q.category)
  )
  select c.category::text,coalesce(n.question_count,0)::bigint
  from catalog c
  left join counts n on n.category=c.category
  order by c.sort_order,c.category;
$$;
revoke all on function public.get_available_categories_v16() from public;
grant execute on function public.get_available_categories_v16() to anon,authenticated;

-- Preserve the V19 Admin RPC name while expanding it to every catalog category,
-- including categories that currently contain zero questions.
create or replace function public.admin_category_population_v19()
returns table(
  category text,
  total_count bigint,
  active_count bigint,
  easy_count bigint,
  medium_count bigint,
  hard_count bigint,
  valid_photo_count bigint,
  missing_photo_count bigint,
  retired_count bigint,
  upvotes bigint,
  downvotes bigint
)
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_trivia_admin() then raise exception 'Admin only'; end if;

  return query
  with cat_source as (
    select c.category,c.sort_order
    from public.trivia_category_catalog c
    where c.enabled=true
    union all
    select distinct trim(q.category),1000
    from public.questions q
    where nullif(trim(q.category),'') is not null
  ), cats as (
    select cs.category,min(cs.sort_order)::integer as sort_order
    from cat_source cs
    group by cs.category
  ), vote_totals as (
    select v.question_id,
      count(*) filter(where v.vote=1)::bigint as upvotes,
      count(*) filter(where v.vote=-1)::bigint as downvotes
    from public.question_votes v
    group by v.question_id
  ), question_rows as (
    select q.id,trim(q.category) as category,q.is_active,q.difficulty,
      public.question_has_valid_photo_v15(q.id) as has_valid_photo,
      coalesce(v.upvotes,0)::bigint as upvotes,
      coalesce(v.downvotes,0)::bigint as downvotes
    from public.questions q
    left join vote_totals v on v.question_id=q.id
    where nullif(trim(q.category),'') is not null
  )
  select
    c.category::text,
    count(qr.id)::bigint as total_count,
    count(qr.id) filter(where qr.is_active)::bigint as active_count,
    count(qr.id) filter(where qr.is_active and qr.difficulty='easy')::bigint as easy_count,
    count(qr.id) filter(where qr.is_active and qr.difficulty='medium')::bigint as medium_count,
    count(qr.id) filter(where qr.is_active and qr.difficulty='hard')::bigint as hard_count,
    count(qr.id) filter(where qr.is_active and qr.has_valid_photo)::bigint as valid_photo_count,
    count(qr.id) filter(where qr.is_active and not qr.has_valid_photo)::bigint as missing_photo_count,
    count(qr.id) filter(where not qr.is_active)::bigint as retired_count,
    coalesce(sum(qr.upvotes),0)::bigint as upvotes,
    coalesce(sum(qr.downvotes),0)::bigint as downvotes
  from cats c
  left join question_rows qr on qr.category=c.category
  group by c.category,c.sort_order
  order by c.sort_order,c.category;
end $$;
revoke all on function public.admin_category_population_v19() from public,anon;
grant execute on function public.admin_category_population_v19() to authenticated;

select jsonb_build_object(
  'catalog_table',to_regclass('public.trivia_category_catalog') is not null,
  'category_count',(select count(*) from public.trivia_category_catalog where enabled=true),
  'admin_rpc',to_regprocedure('public.admin_category_population_v19()') is not null,
  'player_rpc',to_regprocedure('public.get_available_categories_v16()') is not null,
  'status',case when to_regclass('public.trivia_category_catalog') is not null
                    and to_regprocedure('public.admin_category_population_v19()') is not null
                    and to_regprocedure('public.get_available_categories_v16()') is not null
                then 'READY' else 'MISSING' end
) as v20_category_catalog_status;
