# WeTrack License Admin — V2.9.5

## 1. Upgrade Supabase
Run `v295_license_admin_upgrade.sql` once in the Supabase SQL Editor.

This adds `memory_limit_per_trip` to license keys and updates redemption so each key can define:

- Events per day
- Maximum trips
- Memories per trip
- Maps/routes
- Memories
- Shopping lists
- Trip recaps
- Redemption limit
- Optional expiration

Existing keys default to 20 memories per trip and are not revoked or deleted.

## 2. Launch the local admin tool
Windows:

```text
track/tools/run_license_generator_windows.bat
```

or:

```text
python track/tools/license_key_generator.py
```

The tool has four tabs:

### Generate
Creates offline SQL for new keys, or creates keys directly when connected to Supabase.

### Live Licenses
Lists live keys and allows you to:

- Edit events/day, max trips and memories/trip
- Toggle individual Premium features
- Revoke or restore a key
- Optionally revoke/restore users who redeemed that key

When you edit a key in the Live Licenses dashboard, the tool also synchronizes those limits to existing users who redeemed that key.

### User Entitlements
Lists active/manual/license/StoreKit entitlements and allows live editing or revocation.

### Connection
Enter:

- Supabase project URL
- **Service Role** key

The service-role key is required for the live admin dashboard because license tables are intentionally hidden from normal users.

**Never add the service-role key to `app.js`, GitHub Pages, the iOS bundle, or any public repository.** The Python tool keeps the key in memory only by default.

You can optionally set local environment variables:

```text
WETRACK_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
WETRACK_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

## Security note
The live admin tool is an owner/admin utility. Do not distribute it with a populated service-role key.
