# WeTrack V3.2 — Clean V2 Workspace Rebuild

Built from the uploaded working pre-V2 package.

## Key rule
The stable itinerary card CSS/grid was preserved. V2 does not move or rebuild
the card content columns.

## V2 workspaces
- Home
- Plan
- Explore
- Memories
- Tools
- People

Settings -> Display -> App layout switches between V2 Workspace Navigation and
V1 Classic Dashboard.

## Cards
V2 keeps the stable card geometry and uses the existing action column for one
settings gear. The gear menu calls the original Edit / ±30 / Rain / Lock /
Delete buttons, so existing handlers and permissions are preserved.

## Maps
On mobile, compact Apple Maps and Google Maps icon launchers appear next to the
existing address. iOS opens map URLs outside WKWebView.

## Overflow
Only conservative mobile metric sizing guards were added. The previous V2 card
grid overrides were intentionally not carried forward.

No Supabase schema changes.
Cache/build: v540 / V3.2.0
