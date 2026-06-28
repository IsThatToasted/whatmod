# Fantasy Vault — Final Polish Build

Upload the **contents** of this folder directly into `whatmod.com/fantasy/`.

## What changed in this build

- Kept the existing dating UI, Google login, photo upload, Vault, matches, messages, and Admin Studio features intact.
- Changed the top-right cog to a filter/sliders icon because it opens Discovery filters.
- Removed demo/placeholder profile cards from Discover. The app now loads real signed-in profiles from Supabase.
- Removed the public-facing `Reset demo` button from the Profile screen.
- Polished empty states for Discover, Matches, Messages, and Vault.
- Improved mobile spacing/hover polish and photo rendering.
- Updated `supabase-schema.sql` to be non-destructive. It no longer drops the existing `fv_profiles` table.

## Required Supabase update

Run the included `supabase-schema.sql` once after upload.

This adds the authenticated directory-read policy needed for Discover to show other signed-in users. Until another user has created a profile, Discover will show an empty state instead of fake people.

## Supabase Auth URL Configuration

Make sure Supabase Auth uses:

- Site URL: `https://whatmod.com/fantasy/`
- Redirect URLs:
  - `https://whatmod.com/fantasy/`
  - `https://whatmod.com/fantasy`

## Admin access

The Admin tab only appears when the signed-in Google account email is:

`ra1nonit1@gmail.com`
