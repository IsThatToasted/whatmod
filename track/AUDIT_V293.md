# WeTrack V2.9.3 Safe Stabilization Audit

Base: known-working WeTrack V2.8 feature set.

Verified in source:
- Trip Details edit control and destination/date editor wiring present.
- Packing add/edit/delete/reset UI present.
- Packing starter seed changed to advisory-locked RPC only; no blind client bulk insert fallback.
- Premium entitlement RPC + feature gates present.
- Fun Ideas lock button + persistent bucket list code present.
- Memories and shopping-list UI present.
- Map and route code preserved.
- iOS project preserved.
- License generator restored.
- JavaScript passes `node --check`.

Database safety:
- `v293_safe_repair.sql` does not delete trips, events, entitlements, licenses, memories, Fun Ideas, shopping items, or packing rows.
- Account onboarding moved to a dedicated `wetrack_account_profiles` table.
- Legacy/trip-scoped `itinerary_user_profiles` is not modified.
- Old incorrect V2.9.x indexes are dropped without deleting data.
- Existing premium entitlement rows are not modified; only the read RPC is restored.

If packing duplicates still exist, run `PACKING_DUPLICATE_PREVIEW.sql` first. It is read-only.
