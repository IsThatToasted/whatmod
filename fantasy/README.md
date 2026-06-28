# Fantasy Vault — Real Admin Dashboard Build

Upload the contents of this folder directly into `whatmod.com/fantasy/`.

## What changed

- Expanded Admin Studio for `ra1nonit1@gmail.com` only.
- Form-based Vault card creation/editing/deleting.
- Form-based category creation/editing/deleting.
- Form-based answer choice creation/editing/deleting.
- Bulk JSON import/export is still available under Tools, but no longer required for normal editing.
- Changes save to Supabase `fv_admin_config` and refresh the public Vault immediately.
- Profile avatar/nav avatar support remains included.

## Required Supabase pieces

Run `supabase-schema.sql` if you have not already.

Make sure Supabase Auth URL Configuration uses:

- Site URL: `https://whatmod.com/fantasy/`
- Redirect URLs:
  - `https://whatmod.com/fantasy/`
  - `https://whatmod.com/fantasy`

## Admin access

The Admin tab only appears when the signed-in Google account email is:

`ra1nonit1@gmail.com`
