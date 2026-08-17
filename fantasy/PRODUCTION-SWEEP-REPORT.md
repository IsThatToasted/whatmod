# Afterglow Production Sweep — Distribution v3

## Scope

This pass focused on turning the existing hardened build into a distribution-facing release without weakening the current Supabase persistence, wallet, streak, recovery, chat, album, or authentication model.

## Production cleanup

- Removed the generated QA/test-profile pack and its test assets.
- Removed test/reset matching controls from normal app flows.
- Removed data-health and server-backup controls from the member Profile screen.
- Kept those operations available only to the owner under **Admin → Tools → Data Operations**.
- Removed user-facing setup/migration wording and cleaned operational error messages.
- Removed direct browser fallbacks that could mint Glow Coins, purchase/equip inventory, update album permissions, or overwrite protected profile rows when a server RPC is unavailable.
- Updated release/cache version identifiers to the distribution build.

## Profile fixes

- Fixed the Profile hero/avatar layout so the avatar remains inside the hero and cannot cover the Profile Style panel below it.
- Added **View Live Profile** from Edit Profile.
- Added a dedicated public-profile viewer with an obvious **Back** / **Back to Edit** button.
- Public preview excludes wallet, recovery, exact location coordinates, and private account data.
- Added Age to the editable profile form.

## Device location and discovery

- Removed the old York, PA behavior from new-profile defaults. New profiles begin without a hard-coded city.
- Added browser/device geolocation with permission handling, retry/update controls, and automatic first-run prompting for authenticated members without a saved location.
- Coordinates are rounded before saving and remain in the member's protected profile payload.
- `fv_get_directory()` computes Haversine distance on the server and strips location coordinates from directory responses.
- Other members receive only an approximate whole-mile `distanceMiles` value.
- Discover is now a dense photo-first nearby grid rather than a single swipe card.
- Grid tiles show name/age, approximate distance, chemistry, verification, and Plus status.
- Discovery filters now apply show-me, distance, and chemistry preferences.

## 50-mile free tier and Afterglow+

- Free discovery is capped at 50 miles **on the server**, not only in browser JavaScript.
- If a free member deliberately selects the 100-mile filter, profiles beyond 50 miles appear as non-identifying locked previews rather than exposing the full profile. Profiles whose distance cannot be safely calculated are also locked for free members.
- Added `fv_premium_entitlements` with RLS and server-authoritative 30-day entitlement handling.
- Added `fv_purchase_premium_30d()` at **2,300 Glow Coins**.
- Premium purchase is atomic: wallet is locked, coins are deducted on the server, a ledger entry is recorded, and the entitlement is extended.
- Purchase requests use an idempotency key to prevent accidental duplicate charges from retries.
- Active Plus members can use the 100-mile filter and receive an Afterglow+ badge.
- Cash billing is intentionally not simulated. It should be connected to a real billing provider before being offered.

## Daily Glow Gift clarity

- Wallet balance is labeled **Total Glow Coins**.
- Today's claim amount is shown separately under **Today**.
- After claim, **Today** changes to **Claimed** while the total wallet remains visible.
- Seven streak cells display weekday abbreviations and each day's coin reward.
- Claiming remains server-authoritative through `fv_claim_daily_glow()`.

## Supabase/data integrity preserved

The production hardening remains in place:

- revision-locked profile saves;
- conflict-safe multi-device merges;
- localStorage + IndexedDB copies;
- rotating local snapshots;
- cloud profile revisions;
- automatic sync retry after downtime;
- server-authoritative Glow Coin wallet/ledger;
- server-authoritative daily and weekly reward claims;
- protected shop inventory/equipping;
- protected album access and signed media authorization;
- mutual-match messaging enforcement;
- owner-only administrative wallet and backup operations.

## Static verification performed

- JavaScript syntax check passes with Node.
- No duplicate HTML IDs.
- All local HTML asset references resolve.
- All 22 frontend Supabase RPC names have corresponding function definitions in the production SQL.
- No `jsonb_object_length()` reference remains.
- No direct browser writes to wallet, wallet ledger, inventory, or premium tables were found.
- QA test-profile CSS/assets were removed.

## Live verification still required

This environment cannot run the migration against your live Supabase project or complete real Google OAuth, browser permission prompts, two-account distance calculations, live RLS, and multi-device synchronization against production. Use the included acceptance checklist immediately after applying `supabase-distribution-v3.sql`.
