# Afterglow — Glow Shop Build

Upload the contents of this folder directly into `/fantasy/`.

This build preserves the current app and adds:
- Header Glow Coin balance next to the profile photo
- Earned-only Glow Shop tab on the far right of the nav
- Placeholder cosmetic shop items redeemable with Glow Coins
- Profile frames and banner themes that can be unlocked/equipped now
- Inventory saved inside the existing profile JSON so no destructive schema migration is required
- Existing Daily Gift / Glow Coin streak stays intact

No paid features are included. Everything is earned with Glow Coins.


## Patch notes: centered gift + admin wallet tools

- The daily gift/present icon is now centered in the top action button.
- Admin Studio now includes a **Users** tab for owner-only Glow Coin adjustments.
- Run `supabase-schema.sql` again so the owner account can update user wallet balances safely through RLS.
