# Fantasy Vault — Profile Photos + Admin Studio

Upload the **contents** of this folder directly into `https://whatmod.com/fantasy/`.

## What changed

- Kept the current mobile dating-app UI direction.
- Added user profile photo upload/change/remove.
- Photos save locally first, then sync to Supabase Storage when configured.
- Added owner-only Admin Studio tab.
- Admin Studio is visible only when signed in as `ra1nonit1@gmail.com`.
- Admin can edit:
  - Vault answer options
  - Vault categories, emojis, and color themes
  - Vault cards/questions
- Admin config is stored in `fv_admin_config` and loaded by signed-in users.

## Required Supabase setup

Run `supabase-schema.sql` in Supabase SQL Editor.

It creates/repairs:

- `fv_profiles`
- `fv_admin_config`
- `fv-profile-photos` storage bucket
- RLS policies for users and admin-only config editing

## Admin workflow

1. Sign in using Google as `ra1nonit1@gmail.com`.
2. The Admin tab appears in the bottom navigation.
3. Click **Seed / Repair Default Vault Config** the first time.
4. Edit JSON for answer options, categories, or cards.
5. Click **Save Admin Config**.

## OAuth reminder

Google OAuth client redirect URI should stay:

```txt
https://gqkkdocvfstbsekxyrbo.supabase.co/auth/v1/callback
```

Supabase **Authentication → URL Configuration** should use:

```txt
Site URL:
https://whatmod.com/fantasy/

Redirect URLs:
https://whatmod.com/fantasy/
https://whatmod.com/fantasy
https://whatmod.com/fantasy/**
```
