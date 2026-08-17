# Afterglow — Vault, Efficiency & Persistent Matches v4.1

This is the production Afterglow web build with the expanded Glow Vault Builder and the database/storage efficiency pass.

## Existing Supabase project

If **v2.1 production hardening** and **v3 distribution** are already installed, run only:

`supabase-vault-efficiency-v4.sql`

Then deploy the contents of this folder to `https://whatmod.com/fantasy/`.

Do not rerun copied Supabase error text. Use a new SQL Editor query and paste only the migration file contents.

## Fresh Supabase project

Use `supabase-schema-v4.sql`, which combines the existing production schema with the v4 additions.

## v4 highlights

- Custom Dropdown Vault prompts built directly in Admin Studio.
- Numbers Only prompts with min/max/step/unit/placeholder.
- Configurable slider prompts with editable scale and left/middle/right emoji + labels.
- Structured response capture and compatibility support for new answer types.
- Live prompt preview and reorderable custom choices.
- Legacy aggressive polling removed in favor of recipient-filtered Supabase Realtime plus one low-frequency fallback refresh.
- Chat history loaded on demand instead of querying every match to render the chat list.
- Batched signed URL requests for private media.
- Client-side image compression and a 24-photo private-album cap.
- Storage-first album deletion and daily expired-chat-media cleanup.
- Protection against base64 profile-photo previews being written into Supabase profile/revision JSON.
- Owner-only Usage Breakdown for database tables, Storage buckets, and legacy embedded images.

Read `VAULT-EFFICIENCY-SWEEP-v4.md` for the full audit and `PRODUCTION-CHECKLIST-v4.md` before distribution.


## v4.1 persistent-match patch

If v4 is already installed, run `supabase-match-persistence-v4.1.sql` and deploy this folder. The patch makes mutual matches and incoming likes independent of discovery distance/premium locking, keeps established matches visible in Explorer, and makes server relationship flags authoritative on fresh login. See `MATCH-PERSISTENCE-SWEEP-v4.1.md`.
