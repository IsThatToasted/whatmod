-- v0.7.0 rebuilt project-detail durability.
-- Safe to run repeatedly after 005_project_walkthrough_completion.sql.
alter table public.projects add column if not exists client_name text;
alter table public.projects add column if not exists progress_percent integer not null default 0
  check(progress_percent between 0 and 100);
