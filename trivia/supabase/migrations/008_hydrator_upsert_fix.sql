-- WhatMod Trivia V7.3 - Hydrator ON CONFLICT compatibility fix
-- Safe for existing installs. PostgreSQL UNIQUE indexes permit multiple NULLs,
-- so canonical_key does not need a partial predicate.

drop index if exists public.questions_canonical_key_unique;

create unique index questions_canonical_key_unique
  on public.questions(canonical_key);

comment on index public.questions_canonical_key_unique is
  'Full unique index used by PostgREST on_conflict=canonical_key for trivia hydrator upserts.';
