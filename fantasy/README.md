# Fantasy Vault — user profile + private media update

Upload the contents of this zip directly into `/fantasy/`.

Run `supabase-schema.sql` in Supabase SQL Editor before testing private photos.

## Added
- Matched user profile viewer with photo, bio, compatibility stats, shared likes, curiosities, and differences.
- Profile buttons in Matches and Chats.
- 72-hour chat persistence patched to avoid early cleanup during normal reads.
- Private photo / album sharing in matched chats.
- Photo expiry options: 72 hours default, 30 minutes, 24 hours, or 48 hours.
- Private media stored in a non-public Supabase Storage bucket with signed URLs.

## Notes
- Existing features were preserved.
- Messages and photo message records remain queryable only by sender/recipient through RLS.
- Expired rows are filtered out automatically and pruned during app use.
