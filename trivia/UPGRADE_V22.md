# V22 — Free-Plan Storage Hygiene

V22 keeps the Supabase database lean without removing permanent Trivia content.

## What changes

- Compacts `question_audit_log` to changed fields instead of full question snapshots.
- Keeps the selected media plus four useful alternatives per question.
- Keeps rejected media as tiny fingerprints rather than full image metadata.
- Drops the redundant media-provider index.
- Prunes stale presence, bot runtime, old completed-game raw rows, old Practice runtime and old Daily attempts on conservative retention windows.
- Runs storage hygiene at most once every 12 hours through the existing authenticated heartbeat; no cron or Edge Function is required.
- Player presence heartbeat is reduced from 25s to 50s and pauses while the tab is hidden.
- Content Studio resolves at most five candidate images per question and uses a compact category aggregate RPC where available.
- Trivia Admin → Live Ops shows Storage Hygiene status and has a manual cleanup button.

## Install

1. Run `supabase/migrations/021_storage_hygiene_free_plan.sql`.
2. Deploy the V22 frontend/Content Studio files.
3. Optional but recommended once: run `supabase/repair/v22_reclaim_freed_space.sql` when you are not importing/editing media. This physically shrinks the two largest admin tables after V22 deletes/compacts rows.

The physical-reclaim script only locks `question_media_candidates` and `question_audit_log` for their short rewrites; active gameplay does not depend on either table.
