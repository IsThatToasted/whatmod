-- WhatMod Trivia V22 - one-time physical space reclaim
-- Run AFTER 021_storage_hygiene_free_plan.sql.
-- These two tables are admin/content-management tables, not active gameplay tables.
-- VACUUM FULL briefly locks each table while rewriting it, so run this when you are
-- not actively importing/editing questions or media.

vacuum (full, analyze) public.question_media_candidates;
vacuum (full, analyze) public.question_audit_log;
vacuum (analyze) public.questions;
vacuum (analyze) public.games;
vacuum (analyze) public.game_players;
vacuum (analyze) public.game_answers;
vacuum (analyze) public.game_questions;

select
  pg_size_pretty(pg_total_relation_size('public.question_media_candidates'::regclass)) as media_candidates_size,
  pg_size_pretty(pg_total_relation_size('public.question_audit_log'::regclass)) as audit_log_size,
  pg_size_pretty(pg_total_relation_size('public.questions'::regclass)) as questions_size;
