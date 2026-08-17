# Afterglow Distribution v3 — Live Acceptance Checklist

## Database migration

- [ ] Open a new Supabase SQL Editor query.
- [ ] Run `supabase-distribution-v3.sql` on the existing project after v2.1 hardening.
- [ ] Confirm the query completes without an error and commits.
- [ ] Confirm `fv_premium_entitlements` exists.
- [ ] Confirm `fv_purchase_premium_30d`, `fv_get_directory`, `fv_admin_health_summary`, and `fv_admin_export_backup` are callable by authenticated users as intended.

## Login and persistence regression

- [ ] Sign in with Google as an existing member.
- [ ] Confirm existing display name, photo, bio, Vault answers, likes/matches, inventory, Glow Coins, streak, and weekly progress remain intact.
- [ ] Answer a new Vault prompt, reload, and confirm it remains answered.
- [ ] Sign in on a second browser/device, change a different field, then return to the first device and confirm no older state silently erases newer answers.
- [ ] Temporarily disconnect from the network, make a safe profile/Vault change, reconnect, and confirm it syncs.

## Profile and public preview

- [ ] Open Profile and confirm the profile avatar does not overlap the Profile Style panel.
- [ ] Confirm there are no Production Health Check or Server Backup controls on the member Profile page.
- [ ] Choose **View Live Profile**.
- [ ] Confirm the preview shows only public-facing profile information.
- [ ] Confirm **Back to Edit** clearly returns to Profile.
- [ ] Open another profile from Discover and confirm **Back** returns to the grid.

## Location and privacy

- [ ] Test from the HTTPS production URL; browser location APIs should not be tested from an insecure HTTP deployment.
- [ ] Sign in with an account that has no saved location and confirm the browser asks for device location rather than assigning York, PA.
- [ ] Grant permission and confirm Profile shows that device location is on.
- [ ] Use **Update Location** and confirm it refreshes successfully.
- [ ] Deny permission in a separate browser and confirm the app gives a useful retry message rather than inventing a location.
- [ ] With two test accounts in known different areas, confirm Discover shows a sensible approximate whole-mile distance.
- [ ] Inspect a `fv_get_directory` response and confirm another member's latitude/longitude are not present.

## Discover grid and filters

- [ ] Confirm Discover displays a dense profile grid on phone and desktop layouts.
- [ ] Confirm Nearby sorts by distance, Chemistry sorts by score, and New sorts by recency/order as expected.
- [ ] Confirm Show Me and Minimum Chemistry filters work.
- [ ] Confirm unknown-distance profiles remain represented but are locked for a free member until a safe distance can be calculated or Afterglow+ is active.
- [ ] As a free member, select 100 miles and confirm profiles beyond 50 miles are locked.
- [ ] Confirm tapping a locked profile routes to the Afterglow+ offer instead of exposing the full profile.
- [ ] Inspect the network/RPC response as a free member and confirm >50-mile or unknown-distance rows contain only a non-identifying locked shell, not the member bio/photo/Vault data.

## Afterglow+ and Glow Coins

- [ ] Confirm Shop shows the 30-Day Afterglow+ Pass for 2,300 Glow Coins.
- [ ] With fewer than 2,300 coins, confirm purchase is rejected without changing the wallet.
- [ ] With at least 2,300 coins, purchase the pass and confirm exactly 2,300 coins are deducted once.
- [ ] Reload and sign in on another device; confirm the entitlement remains active.
- [ ] Confirm the user can now open profiles beyond 50 miles when the 100-mile filter is selected.
- [ ] Confirm the public profile displays the Afterglow+ badge.
- [ ] Retry the same purchase request/idempotency path and confirm it does not double-charge.

## Daily Glow Gift

- [ ] Before claiming, confirm the modal shows **Total Glow Coins** and a separate **Today** reward amount.
- [ ] Confirm the seven reward cells show weekday abbreviations and coin amounts.
- [ ] Claim the gift once and confirm **Today** becomes **Claimed**.
- [ ] Confirm the total wallet increases by exactly the server-returned reward.
- [ ] Reload and confirm the gift remains claimed for that server day.
- [ ] Confirm a consecutive-day login increments the streak and a missed day resets the streak appropriately.

## Shop, chat, album, and rewards regression

- [ ] Buy a normal shop item and confirm it is charged exactly once server-side.
- [ ] Equip a cosmetic, reload, and confirm it remains equipped.
- [ ] Complete an eligible weekly goal and confirm its reward cannot be claimed twice.
- [ ] Match two accounts and confirm they can message each other.
- [ ] Confirm unmatched accounts cannot bypass mutual-match messaging rules.
- [ ] Test private album request, accept/deny/revoke, and signed photo access with two matched accounts.

## Owner Admin

- [ ] Sign in with the owner account on a desktop-sized browser.
- [ ] Open Admin → Tools and confirm **Data Operations** is visible there only.
- [ ] Run **Check Data Health** and confirm profile/wallet/recovery/active-Plus counts load.
- [ ] Run **Download Server Backup** and confirm a JSON backup downloads.
- [ ] Confirm a non-owner cannot access owner admin RPCs.

## Final release check

- [ ] Hard-refresh the production URL and verify the new cache version loads.
- [ ] Check browser console for uncaught errors while visiting Discover, Matches, Vault, Chat, Profile, Shop, and Admin as applicable.
- [ ] Verify mobile layout on iPhone Safari and Android Chrome or equivalent device emulation.
- [ ] Keep a fresh server backup before public launch.
