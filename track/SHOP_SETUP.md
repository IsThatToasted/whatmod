# WeTrack Shop / App Store setup

The Shop can be disabled instantly by changing `track/shop-config.js` to `enabled: false`. The existing license-key system remains intact.

## Products to create in App Store Connect

Create the base auto-renewable subscription in a `WeTrack Premium` subscription group:
- `com.wetrack.premium.monthly` — target display price **$7.95/month** (choose the closest App Store price point available in your storefront).

Create a separate `WeTrack Memory Capacity` subscription group. Only one capacity tier is active at once, which lets the customer upgrade/downgrade rather than accidentally stacking duplicate subscriptions:
- `com.wetrack.memories.plus20.monthly` — +20 Memories — target $0.99/month
- `com.wetrack.memories.plus40.monthly` — +40 Memories — target $1.98/month
- `com.wetrack.memories.plus60.monthly` — +60 Memories — target $2.97/month
- `com.wetrack.memories.plus80.monthly` — +80 Memories — target $3.96/month
- `com.wetrack.memories.plus100.monthly` — +100 Memories — target $4.95/month

The base plan includes 20 Memories per trip. Memory tiers raise the limit to 40/60/80/100/120.

## Supabase
Run `v294_shop_upgrade.sql` once. Existing manual/license-key Premium users remain Premium and default to 20 Memories per trip unless you manually set a different `memory_limit_per_trip`.

## Important production note
The iOS wrapper verifies StoreKit transactions locally before forwarding them to the web app. `record_wetrack_storekit_purchase` records that verified result in Supabase. Before public App Store launch, the strongest setup is to additionally verify Apple signed transaction data server-side and process App Store Server Notifications so refunds/cancellations/renewals remain authoritative even when the app is not opened.
