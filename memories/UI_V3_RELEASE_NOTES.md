# Memories Aura UI — V3

This release replaces the previous dashboard/editorial visual direction with a mobile-first interface designed to feel at home on iOS and Android.

## What changed

- New Aura visual identity and application icon
- Floating glass navigation rail on desktop
- Native-style bottom tab bar and central capture action on mobile
- Safe-area-aware mobile headers and controls
- Edge-to-edge featured memories and horizontally swipeable memory streams
- Bottom-sheet forms and memory details on phones
- Reworked timeline, pathways, fragments, constellation, library, settings, and authentication surfaces
- New motion, depth, translucent materials, and adaptive light/dark styling
- Updated iOS launch experience to match the web application

## Compatibility

No Supabase schema migration is required. Existing memories, users, uploads, pathways, people, places, chapters, authentication, and realtime sync remain compatible.

The service-worker cache was advanced to `whatmod-memories-v3`, so the new assets replace previous cached interface files after deployment.
