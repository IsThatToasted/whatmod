# Trivia V8 — Release UI + Graph System

## What changed

- Rebuilt all numeric result graphs around one collision-safe responsive renderer.
- Community graphs automatically zoom to the useful cluster instead of always showing the full ±4-decade storage range.
- Answer and player labels move to separate rows when they are too close to each other.
- Daily, Practice, Party results, and replay/community charts now share the same formatting rules.
- Added ResizeObserver rerendering for rotation and responsive layouts.
- Added V2 Arena release interface while preserving the previous interface as V1 Classic.
- Added Profile → Player Settings → Interface Theme.
- Theme preference is saved locally immediately and to the user's Supabase profile when signed in.
- New/existing players default to V2 after migration 009; switching themes never changes game/progression state.

## Existing deployment

1. Apply the V8 drop-in package over the repository. It does not contain `trivia/config.js`.
2. Run `trivia/supabase/migrations/009_release_ui_theme.sql` in Supabase SQL Editor.
3. Push to GitHub.
4. Hard refresh once; service-worker cache is now `whatmod-trivia-v8`.

No existing XP, Daily attempts, library sessions, question data, media, or game history is changed.
