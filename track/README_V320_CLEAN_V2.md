# WeTrack V3.2.0 — Clean V2 Workspace Reimplementation

This release is rebuilt from the uploaded pre-V2 working package.

## Safety rule
The working timeline/card CSS was intentionally left unchanged.
V2 changes navigation and module visibility only.

## Layout setting
Settings → Display → App layout:
- V1 · Classic Dashboard
- V2 · Workspace Navigation

V2 spaces:
- Home
- Plan
- Explore
- Memories
- Tools
- People

No DOM reparenting is used. Existing IDs, forms, Supabase handlers and timeline
card layout stay in their original locations.

## Mobile Maps
Events with addresses receive two small mobile-only icon shortcuts below the
existing address:
- Apple Maps
- Google Maps

No event-card grid/flex geometry is redefined by this release.

## Database
No Supabase migration is required.

Cache/build: v540 / WeTrack V3.2.0.
