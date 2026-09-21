# Trivia V21 — Connected Content Studio

V21 is a local Content Studio upgrade. No Supabase SQL migration is required.

The Windows Content Studio can now optionally connect directly to the live Supabase project using a server-side Secret key (`sb_secret_...`) or legacy `service_role` key. The key is held only by the local Python backend and is DPAPI-encrypted on Windows.

New local features:
- Live Bank category population dashboard.
- Live question search/filter/editor.
- Add, edit, retire, and restore questions directly.
- Publish acquired + resolved content directly to Supabase.
- JSON export remains available as a backup.
- Universal JSON drag/drop inbox fixes category/media job drops.

The hosted Trivia player and Trivia Admin runtime are unchanged in V21; the Admin download bundle now serves the V21 Content Studio.
