# Afterglow v4 — Vault Builder & Supabase Efficiency Sweep

## Vault Builder expansion

The Vault editor now supports eight response modes without changing existing prompt IDs or stored answers:

- Global answer buttons
- Yes / No buttons
- Custom answer buttons
- Custom dropdown
- Numbers only
- 1–10 slider scale
- Short written answer
- Long written answer

### Custom dropdown

Admins build dropdown choices directly in the prompt editor. Each choice has a stable answer key and editable display label, can be reordered, added, or removed, and is shown in a live prompt preview. Member answers are stored as a structured object containing the stable key and display text so changing presentation later does not make old answers unreadable.

### Numbers only

Admins can configure optional minimum and maximum values, step size, unit/suffix, and placeholder. Member values are parsed as numbers, snapped to the configured step, clamped to min/max, and stored as numeric data rather than arbitrary text.

### Slider

The default slider is 1–10 with:

- Left: 🤢 Yuck
- Middle: 😐 Meh
- Right: 😍 Love

Minimum, maximum, step, all three emojis, all three labels, and whether the selected number is displayed are editable per prompt. Numeric/slider compatibility uses proximity rather than pretending every numeric value is a normal global answer key.

## Database request audit

The v3 client contained overlapping polling systems. Directory refresh ran on an 8-second cadence in the older path, active chats on 3 seconds, and the global notification path also performed repeated directory/chat refreshes. With one active/matched conversation this could easily generate well over one thousand database/API calls in an hour.

v4 removes the active legacy polling loops. Incoming messages use one recipient-filtered Supabase Realtime subscription. A single 120-second safety refresh remains for directory/like freshness and degraded-Realtime recovery. Chat history loads on demand instead of issuing one query for every match while drawing the conversation list.

Static audit result: one `setInterval()` remains in the production JavaScript, and it is the 120-second safety refresh.

## Storage efficiency and cleanup

- Profile uploads are resized/compressed before upload to roughly 750 KB maximum target.
- Private chat and private-album photos are resized/compressed to roughly 950 KB maximum target.
- Private albums are capped at 24 photos so hidden/unbounded objects cannot accumulate.
- Album signed URLs are requested in one batch rather than one Storage API request per image.
- Chat signed URLs are also batched and cached for their useful lifetime.
- Private-album deletion removes the Storage object before deleting its metadata row, reducing the risk of orphaned paid bytes.
- Failed multi-file uploads roll back objects that were uploaded before the failure.
- Expired private-chat media cleanup runs at most once per user per day and removes the Storage objects before pruning expired rows.
- Replaced profile avatars still remove the prior Storage object.

## Embedded-avatar protection

The audit found a subtle legacy storage problem: the old profile-photo preview temporarily placed a base64 data URL into profile state. If an upload took longer than the sync debounce, that preview could be synchronized into profile JSON and copied into cloud revisions.

v4 keeps signed-in photo previews transient and explicitly strips `data:image/...` values from cloud sync payloads. If an existing user still has a legacy embedded avatar, the client migrates it into the profile-photo Storage bucket when that user signs in. The v4 migration includes an authenticated cleanup function that replaces old embedded avatar copies in that user's recovery revisions with the durable Storage URL after migration succeeds.

## Owner usage diagnostics

Admin → Tools → Data Operations now includes **View Usage Breakdown**. The v4 database function reports:

- total database size
- profile table size
- revision table size
- message table size
- activity table size
- wallet-ledger size
- private-album metadata size
- object count and bytes per Storage bucket
- count and bytes of legacy embedded profile/revision images

This makes it possible to tell whether a dashboard percentage is Database/Disk usage or object Storage usage instead of guessing from the percentage alone.

## Migration

For an existing Afterglow project that already has the v2.1 production-hardening and v3 distribution migrations installed, run only:

`supabase-vault-efficiency-v4.sql`

The migration is additive. It enables Realtime publication for `fv_messages`, adds a targeted message index, installs owner usage diagnostics, and installs legacy-avatar revision cleanup. It does not reset Vault answers, profiles, wallets, streaks, inventory, premium entitlements, or album metadata.

## Static verification

- `node --check app.js` passes.
- 152 HTML IDs are unique.
- All local HTML references resolve.
- 24 frontend Supabase RPC names have SQL function definitions in the included schema/migrations.
- Only one production JavaScript interval remains.
- No single-object `createSignedUrl()` calls remain; private media uses batched `createSignedUrls()`.
- No direct browser mutations to wallet, wallet ledger, or premium-entitlement tables were found.
- `jsonb_object_length()` does not appear in the v4 migration.
- The v4 SQL passed delimiter/quote/parenthesis static validation.

## Live verification still required

The local audit cannot see the project's actual Supabase Usage dashboard or execute against production credentials. After installing the migration, use Admin → Tools → Data Operations → View Usage Breakdown and compare it with the Supabase Usage page. That will identify the exact bucket/table responsible for the current ~30% reading.
