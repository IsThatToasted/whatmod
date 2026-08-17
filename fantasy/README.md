# Afterglow — Distribution Build v3

This folder is the production-ready web build of Afterglow.

## Deploying this update

### Existing Supabase project

If the v2.1 production-hardening migration is already installed, run **only**:

`supabase-distribution-v3.sql`

Then deploy the contents of this folder to the live Afterglow web path.

Do not rerun an older failed SQL/error transcript in the Supabase editor. Start with a new SQL query and paste only the contents of the migration file.

### Fresh Supabase project

For a new database, use `supabase-schema.sql`. It contains the base schema, production hardening, and the v3 distribution additions.

## What v3 adds

- Device/browser geolocation for nearby discovery. A member must grant browser permission; the saved coordinates are used on the server to calculate distance.
- Privacy-safe directory results. Other members receive only an approximate whole-mile distance, not another user's coordinates.
- Dense photo-first Discover grid with nearby, chemistry, and new sorting plus member filters.
- Full public-profile viewer and a **View Live Profile** preview from Edit Profile.
- Afterglow+ 30-day entitlement purchased server-side for 2,300 Glow Coins.
- Server-enforced free discovery up to 50 miles. Choosing the 100-mile filter shows non-identifying locked distant profiles until Afterglow+ is active; profiles with unavailable distance are also locked for free members.
- Clear Daily Glow Gift display separating total wallet balance from today's reward and labeling the seven reward days by weekday.
- Owner-only database health and server backup controls moved to Admin → Tools instead of member Profile.
- Production cleanup of QA/test profile assets and user-facing development controls.

## Location requirement

Browser geolocation normally requires a secure context. Deploy the app over **HTTPS** and allow location permission for the site. If a member denies permission, they can enable it later in their browser and use **Use Current Location** from Profile.

The City / Area field remains optional and is not inferred from coordinates. Afterglow does not need reverse geocoding to calculate nearby distance.

## Afterglow+ pricing

The live in-app coin entitlement is **2,300 Glow Coins for 30 days**. No fake cash checkout is exposed in this web build. Add Stripe/App Store/Google Play billing only when the corresponding payment integration is configured.

When paid Glow Coin packs are introduced, price them so acquiring 2,300 coins costs more than a direct monthly Afterglow+ subscription. A sensible direct subscription target is around **$9.99/month**, with coin packs priced so they do not undercut that subscription.

## Data safety

Profile/Vault state saves locally first, mirrors to IndexedDB, syncs with revision conflict protection, keeps local snapshots, and stores cloud recovery revisions. Glow Coins, streaks, rewards, shop purchases, premium entitlement, album permissions, and related protected mutations are server-authoritative.

See `PRODUCTION-CHECKLIST.md` before public distribution.
