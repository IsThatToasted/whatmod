# Fantasy Vault — Live Directory + Mutual Match Fix

Upload the contents of this folder directly into `https://whatmod.com/fantasy/`.

This build keeps existing features and adds:

- Automatic profile refresh every 15 seconds while the app is open.
- Refresh on browser focus / tab return.
- Incoming likes now appear in Matches as “Liked you”.
- User can tap “Like back” to create a mutual match.
- Chat only appears after both people like each other.
- Save Profile remains the visible profile save action.

## Supabase requirement

Run or confirm the included `supabase-schema.sql`. The directory policy must allow authenticated users to read profile rows, including `liked`, so incoming likes can be detected.


## This build
- Adds Reset likes & matches for testing.
- Adds Unmatch controls on matched users.
- Moves users out of Nearby after either side likes.
- Adds lightweight per-session chat; messages stay in sessionStorage and are not saved to Supabase.
