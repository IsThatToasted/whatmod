# WeTrack V3.0 — License Redemption Stabilization

## Why this release exists
The web app still contained old Premium redemption handlers and `schema.sql`
could overwrite the newer single-current-entitlement RPC with an older
multi-row implementation.

That could produce a false "invalid key" message while another overlapping
redemption call succeeded moments later.

## Deploy
1. Run `track/v300_license_redemption_fix.sql` in Supabase.
2. Deploy the updated `track/` folder.
3. Hard refresh desktop and fully close/reopen iOS.

## Improvements
- One serialized client redemption request, even if old UI listeners fire.
- One authoritative `wetrack_user_entitlements` row per account.
- Case/leading/trailing whitespace tolerant key lookup.
- Failed redemption is checked against current entitlement before an error is shown.
- `schema.sql` now ends with the V3.0 authoritative licensing functions so
  rerunning the complete schema cannot silently regress licensing again.
- New admin-generated keys remain generation 2.
