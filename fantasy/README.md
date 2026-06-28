# Fantasy Vault — 72 Hour Messages Build

Upload the contents of this zip directly into `/fantasy/`.

## What changed
- Replaced broken per-session chat with Supabase-backed messaging.
- Messages are stored in `fv_messages` and expire after 72 hours.
- The app cleans expired messages during normal use.
- Chat refreshes every few seconds while open.
- Chat previews refresh for matched users.
- Reset/unmatch clears the current user's test chat rows.
- Directory/profile refresh now runs every 8 seconds while the tab is active.

## Required Supabase step
Run the included `supabase-schema.sql` in the Supabase SQL Editor so the new `fv_messages` table and RLS policies exist.

No existing profile, vault, admin, photo, or matching features were removed.
