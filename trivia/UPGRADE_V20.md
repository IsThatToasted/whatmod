# Trivia V20 — Category Catalog + Smart Imports

## What changed
- Persistent `trivia_category_catalog` keeps all built-in/player-facing categories visible even at zero questions.
- Existing and future custom categories are auto-registered by a question-category trigger.
- `admin_category_population_v19()` now returns empty categories with zero counts so Admin can hydrate them.
- `get_available_categories_v16()` now returns the full enabled catalog with zero counts; player UI disables empty categories before play.
- Trivia Admin Category Command Center marks zero-count categories as `EMPTY` and gives them a prominent Hydrate action.
- Trivia Admin now has one drag/drop Smart JSON Import area that detects Content Packages, Media Results/media-only packages, and Question Edit Packs.
- Content Studio shows all player-facing categories, including categories with no fixed generators/questions.
- Content Studio category jobs use fixed generators when available and Topic Discovery fallback otherwise.
- Content Studio exposes `/api/version` and has a compatibility fallback if an older Python backend is still running.
- Windows launcher stops an older WhatMod Content Studio process on port 8767 before starting the current backend, preventing stale-backend 404s.

## Install
1. Deploy the V20 drop-in.
2. Run `supabase/migrations/020_category_catalog_universal_import.sql` in Supabase once.
3. Replace/restart the Windows Content Studio. Close any old Content Studio terminal first; the new launcher also attempts to stop the prior local instance automatically.
4. Hard-refresh Trivia and Trivia Admin once.

Expected SQL verification status: `READY`.
