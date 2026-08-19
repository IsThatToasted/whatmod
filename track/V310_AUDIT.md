# WeTrack V3.1 Display V2 Audit

- Existing Supabase/data code remains in `app.js`; V2 navigation lives in isolated `display-v2.js`.
- V1 Classic remains selectable in Settings.
- V2 defaults for users without a stored display preference.
- No database/schema migration is required.
- Home, Plan, Explore, Memories, Tools, and People are separate presentation workspaces.
- Tools uses focused Packing / Must Do / Gas / Activities sub-tabs.
- Existing element IDs are preserved.
- Mobile event cards with locations now render explicit Apple Maps and Google Maps actions.
- iOS wrapper opens mapping links externally rather than swallowing them in WKWebView.
- App and V2 display JavaScript pass Node syntax validation.
- Cache version bumped to v530.
