# WeTrack V3.1 — V2 Workspace Presentation Layer

This release keeps the existing application/data layer intact and adds a second
presentation/navigation mode.

## Display setting
Settings → Display → App layout:
- V1 · Classic Dashboard
- V2 · Workspace Navigation

V2 is the default for devices that have never selected a layout. Existing
preferences can switch back to V1 at any time.

## V2 spaces
- Home — trip command center
- Plan — itinerary and timeline only
- Explore — full-width daily route/map
- Memories — photo/memory workspace
- Tools — focused sub-tabs for Packing, Must Do, Gas Calculator, and Activity Generator
- People — invitations and traveler area

## Mobile
V2 uses a persistent bottom navigation:
Home / Plan / Explore / Memories / More.

## Event map buttons
On mobile, every event with a location shows explicit:
- Apple Maps
- Google Maps

The iOS wrapper also intercepts these links and opens them outside the embedded
WKWebView, fixing the previous no-op address behavior.

## Database
No Supabase/schema migration is required.

Cache version: v530.
