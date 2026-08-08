# WeTrack V2.9.3 — Safe Feature Restore

This release deliberately returns the web/iOS app to the known-good V2.8 feature baseline, then reapplies only two stabilization changes:

1. account-level onboarding persistence via `wetrack_account_profiles`
2. race-safe starter packing initialization

It does **not** replace, delete, or migrate trips, licenses, entitlements, Fun Ideas, memories, shopping lists, events, or existing packing rows.

## Deploy
1. Run `v293_safe_repair.sql` once in Supabase SQL Editor.
2. Deploy the `track/` folder.
3. Hard-refresh the browser and fully close/reopen the iOS app.
4. Confirm the build badge shows `WeTrack V2.9.3 Safe Stabilization`.

## Licensing tool
The Windows/Python license generator is restored under top-level `tools/`.

## If packing still looks duplicated
Run `PACKING_DUPLICATE_PREVIEW.sql` first. It is read-only. Do not delete rows until the preview is reviewed.
