# V13 — Nova Arena UI / Release Experience Pass

V13 is a visual-and-interaction release pass. It does not require a Supabase migration.

## Themes
- **V1 Classic** is preserved and remains the default for users who do not choose V2.
- **V2 Nova Arena** is a fully separate shell with a left command rail, mission-control home, arena surfaces, responsive mobile dock, animated backgrounds, depth/tilt interactions, particles, and new game presentation.
- The existing `profiles.ui_theme` setting continues to synchronize V1/V2 for signed-in users.

## Game feel
- New zero-asset Web Audio sound engine for navigation, selection, lock-in, reveal, success, victory, and error cues.
- Player Settings now includes Sound FX, Motion FX, Haptics, and FX Volume.
- Settings are stored locally and do not change game state.
- `prefers-reduced-motion` and the in-app Motion FX toggle disable decorative motion.

## Other surfaces
- Trivia Admin has a new command-center visual pass.
- Windows Content Studio has a matching creator-workstation visual pass.

## Deployment
Replace the current files and deploy. No SQL is needed. The service worker cache is `whatmod-trivia-v13`.
