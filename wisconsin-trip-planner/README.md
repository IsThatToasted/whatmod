# Bedroom Connection Builder

Private one-on-one adult bedroom compatibility builder using Supabase Auth, Supabase tables, realtime sync, and static GitHub Pages hosting.

## Deploy

1. Upload these files to your GitHub Pages directory.
2. Keep `config.js` with your Supabase URL and publishable/anon key.
3. Run `supabase-schema.sql` in the Supabase SQL editor if you have not already.
4. In Supabase Auth, add your GitHub Pages URL to allowed redirect URLs.
5. Hard refresh the deployed page with `Ctrl + Shift + R`.

## Notes

- Existing table names are preserved: `bcc_profiles`, `bcc_sessions`, `bcc_session_members`, `bcc_answers`.
- No embedded Supabase joins are used; this avoids schema-cache relationship errors.
- The app includes 140 adult bedroom compatibility questions.
- Each user signs in separately with Google.
- Invite links are one-on-one. A third user is blocked by the app and schema trigger.
- Results reveal after both users answer all questions.
