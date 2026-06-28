# Fantasy Vault - Profile Save + Public Directory Fix

Upload the contents of this zip directly into `/fantasy/`.

This build keeps existing features and patches profile/account handling:

- Adds a user-facing **Save profile** button.
- Keeps Supabase sync functions in the background.
- Stops one Google account from inheriting another user's local profile data on the same browser.
- New profiles now initialize from the signed-in Google account name/photo instead of the old Brian demo default.
- Adds a migration guard for accounts that were accidentally saved as Brian from the older shared-localStorage build.
- Refreshes the Discover/Matches/Chat directory after saving.
- Uses the existing `fv_profiles` directory read policy so authenticated users can see other profiles.

If other users still cannot see profiles, re-run `supabase-schema.sql` to ensure this policy exists:

```sql
create policy "Authenticated users can read Fantasy Vault directory"
on public.fv_profiles for select
to authenticated
using (true);
```
