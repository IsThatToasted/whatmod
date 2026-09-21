# WhatMod Trivia V9 — Local Media Pipeline

V9 moves bulk media resolution off GitHub Actions.

## New workflow

1. Open `/triviaadmin/`.
2. Under **Local Media Pipeline**, export a media job JSON.
3. Download/run the Windows resolver.
4. Load the job and resolve locally.
5. Review/override candidates if desired.
6. Export the result JSON.
7. Import the result JSON in `/triviaadmin/`.

The local resolver never receives a Supabase URL or secret. It only resolves public image metadata.
The authenticated admin page performs the database import through admin-only Supabase RPCs.

## GitHub Actions

- `Trivia Question Bank Sync` hydrates questions only.
- `Trivia Media Resolver` is retained as a manual fallback only. It has no schedule.
- Bulk media work should use the local resolver to avoid GitHub Actions usage.

## Theme

V1 is the default release theme again. Existing explicit choices are preserved. V2 remains selectable as an experimental alternate interface until it receives a future ground-up redesign.

## Database

Run `010_local_media_pipeline.sql` once.
