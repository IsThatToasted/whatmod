# Trivia V4 production hardening

For an existing V3 database, run `supabase/migrations/004_production_hardening.sql` once in the Supabase SQL Editor, then deploy the V4 frontend.

This migration is non-destructive. It fixes ambiguous PL/pgSQL column references in Practice and latent multiplayer conflicts, fully qualifies mutable round/session columns, and narrows RPC execute privileges.
