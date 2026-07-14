# Afterglow Production Sweep Report

Build: `2026.07.13-production`

## Root cause addressed

The previous login boot path could treat a sparse, stale, or newly generated profile state as authoritative and replace a richer copy. The production build now distinguishes temporary defaults, durable browser records, IndexedDB recovery records, and actual server rows. Vault answers and other durable fields are merged before any protected write.

Every cloud save now includes the last server revision observed by that browser. If another device has already committed a newer revision, Supabase returns a conflict row; the app snapshots the local copy, merges the latest server state, and retries. Missing Vault keys, purchased inventory, or current-week completion keys also trigger conflict recovery rather than deletion.

## Persistence and recovery controls

- Immediate user-specific localStorage save.
- Independent IndexedDB mirror of the latest state.
- Up to 25 rotating local snapshots, including forced snapshots before destructive changes and conflict merges.
- Automatic cloud retry after network or Supabase downtime.
- Cloud profile revision history, retaining the latest 75 revisions per user.
- Personal JSON export/import and local/cloud restore tools.
- Owner-only full durable database JSON export.
- Practical server payload limits and UUID sanitization for durable like/pass data.

## Economy integrity

- Glow Coins, streaks, claims, purchases, equips, and admin adjustments are server-authoritative.
- Wallet changes are atomic and recorded in an immutable ledger.
- Daily claims use a server-validated, fixed IANA timezone and retain the complete consecutive-day streak.
- Weekly goals use ISO weeks and current-week server evidence.
- Mood and Vault weekly rewards require newly recorded activity events; an old profile resync is not sufficient.
- Legacy browser balances above the server wallet are preserved as reviewable recovery requests instead of silently granted or discarded.

## Privacy and authorization

- Directory reads use a restricted RPC rather than exposing complete profile rows.
- Public profile cosmetics are derived from purchased server inventory.
- Mutual matching is enforced by the database before direct messages or private-album requests.
- Album request and response state is changed only through atomic server functions.
- Private-album access survives expiring chat messages and is enforced for metadata and Storage objects.
- Chat photo paths must belong to the sender and identify image media.
- Direct profile, wallet, ledger, activity, inventory, album-access, revision, and recovery-request writes are revoked from browsers.
- The internal economy JSON helper cannot be called directly by browser roles.
- User-generated text and image URLs are sanitized, and the page includes a restrictive Content Security Policy.

## Storage hygiene

Profile images are compressed for the offline recovery copy. When a new cloud avatar replaces an older one, the previous owner-controlled Storage object is removed. Removing an avatar also attempts to remove its stored object.

## Static and logic verification completed

- JavaScript syntax check passed.
- Application smoke test passed.
- State merge/recovery logic tests passed.
- Fresh-login default-versus-cloud recovery test passed.
- Base migration parsed: 92 statements.
- Production hardening migration parsed: 182 statements.
- Combined install/upgrade script parsed: 274 statements.
- 21 frontend RPC calls matched to SQL functions.
- All referenced frontend tables and Storage buckets matched the schema.
- All 26 frontend shop items matched server catalog entries.
- 125 HTML IDs checked with no duplicates.
- All local HTML/CSS assets resolved.
- All 20 bundled test-profile images passed integrity checks.
- Local HTTP delivery test passed for HTML, JavaScript, CSS, config, and image assets.
- No service-role credential is included in the client config.

## Required live acceptance testing

The migration was not executed against the live Supabase project from this environment, and live Google OAuth, RLS, Storage signing, multi-account matching, and real browser rendering could not be fully exercised here. Run `supabase-production-hardening.sql` in the existing project, deploy the static files, and complete `PRODUCTION-CHECKLIST.md` before considering the release accepted.

No software can guarantee recovery after every cloud copy, browser copy, export, and provider backup has already been destroyed. This build prevents the observed overwrite path and adds multiple independent recovery layers; periodic owner server exports and Supabase Storage/provider backups remain necessary for disaster recovery.
