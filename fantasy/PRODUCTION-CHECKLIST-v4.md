# Afterglow v4 Production Checklist

- [ ] Confirm v2.1 production hardening and v3 distribution migrations are already installed.
- [ ] Run `supabase-vault-efficiency-v4.sql` in a fresh Supabase SQL Editor tab.
- [ ] Confirm the migration completes with no error before deploying the web files.
- [ ] Deploy the contents of this `fantasy` folder and hard-refresh the site.
- [ ] Admin → Vault Builder: create a Custom Dropdown with at least three custom choices, publish it, answer it as a member, reload, and confirm the same answer returns.
- [ ] Create a Numbers Only prompt with min/max/step/unit, answer it, reload, and confirm the numeric value persists.
- [ ] Create a Slider prompt; edit the left/middle/right emoji + labels, publish, answer, reload, and confirm the numeric value and custom labels render correctly.
- [ ] Open two matched accounts. Leave one idle for several minutes and verify new chat messages arrive without page refresh.
- [ ] In Supabase Usage, confirm database request rate drops substantially compared with the previous polling build.
- [ ] Admin → Tools → Data Operations → View Usage Breakdown. Record database MB and each Storage bucket MB/object count.
- [ ] Replace a profile photo and confirm the old object disappears from `fv-profile-photos` after the successful replacement.
- [ ] Add then remove a private-album photo and confirm its object is removed from `fv-private-albums`.
- [ ] Send an expiring private chat photo; after expiry and a later app visit, confirm expired media cleanup removes the object and expired message row.
- [ ] Confirm private albums stop accepting new photos at 24 items.
- [ ] If Usage Breakdown reports legacy embedded image copies, sign into the affected account(s), allow the automatic avatar migration to complete, then run Usage Breakdown again.
- [ ] Re-test Glow Coin balance, daily streak claim, shop purchase, Afterglow+ entitlement, discovery distance, profile edit, live profile, matching, and chat after the migration.
