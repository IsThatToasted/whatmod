# WeTrack V2.9.8 — Licensing Consolidation

## Goal
One user = one authoritative current entitlement.

`wetrack_user_entitlements` is now the only table used by
`get_itinerary_license_status()`. Historical redeemed/revoked keys no longer
compete when PC/iOS decide whether Maps, Memories, Shopping or Recaps are enabled.

## Deploy
1. Run `track/v298_current_entitlements.sql` in Supabase.
2. Deploy the updated `track/` files.
3. Restart the iOS app and hard-refresh desktop.
4. Open the updated License Admin tool and confirm each email appears exactly
   once under **Users · Current**.

## Admin tool
- Generate: creates generation-2 keys with configurable limits.
- Live Licenses: issued/redeemable keys.
- Users · Current: one row per account; edit/revoke here for immediate access changes.
- History: audit trail of redemptions, admin changes and StoreKit purchases.
- Connection: local service-role connection.

## Legacy entitlement table
`itinerary_user_entitlements` is retained so nothing is destructively removed.
The app no longer uses it for feature gating.

After V2.9.8 is verified you may optionally run
`OPTIONAL_V298_ARCHIVE_LEGACY_ENTITLEMENTS.sql`. This is not required.

## Revoke behavior
Revoking a user in **Users · Current** revokes that account, regardless of how
many old keys they used. Revoking an issued key prevents future redemptions.
