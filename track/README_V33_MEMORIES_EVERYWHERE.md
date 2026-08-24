# WeTrack V3.3 — Memories Everywhere

## New memory flow
- Take Photo uses the live device camera.
- Choose Photos opens the device photo library and supports multiple images.
- After selecting photos, WeTrack asks for optional estimated date + description.
- Those details use existing `memory_date` and `note` fields; no schema migration is required.
- Each user's own memory details can be edited later.

## After the trip
- Completed trip experience remains writable.
- If photos exist: Add More.
- If no photos exist: Add Memories Now.
- Full slideshow can be opened even when empty and presents a large Add Memories Now state.

## Slideshow
- Add More is always available.
- Edit button appears for memories the current user can edit.
- Empty slideshow has a large onboarding-style memory CTA.

## Premium capacity
Batch photo additions respect the existing per-trip memory entitlement limit.

No Supabase SQL changes.
Cache/build: v550 / V3.3.0.
