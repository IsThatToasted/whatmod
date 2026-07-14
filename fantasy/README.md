# Afterglow — Production Data-Safety Build

This build is a production hardening pass for the existing Afterglow web app. The current Google/Supabase login flow is preserved.

## What changed

- **Vault answers are protected from empty/stale cloud rows.** Login now merges durable fields instead of replacing browser data with an empty response.
- **Local-first saving.** Every meaningful change is saved on-device immediately and cloud sync retries automatically after a pause, outage, or reconnect.
- **Recovery copies.** The app keeps up to 25 rotating local snapshots, a second IndexedDB recovery mirror, and cloud profile revisions. A Data Safety panel supports manual sync, JSON export/import, and restores.
- **Server-authoritative Glow Coins.** Daily rewards, weekly rewards, purchases, equips, and admin adjustments use atomic database functions and an immutable wallet ledger.
- **Legacy wallet review.** If a browser backup contains more coins than the new server wallet, the higher local value is snapshotted and submitted for owner review instead of silently disappearing.
- **Accurate streak dates.** Daily claims use a validated IANA timezone and preserve the full consecutive-day count beyond day seven. The reward schedule still caps at the day-seven reward.
- **Correct weekly resets and proof.** Weekly goals use ISO weeks, and mood/Vault rewards require server-recorded activity from the current week rather than an ordinary profile resync.
- **Private data hardening.** Raw directory rows, full like lists, private album paths, chat media, wallets, and inventory are no longer broadly readable.
- **Durable album permissions.** Private album approvals persist separately from expiring chat messages and require a mutual match.
- **Stale-build and multi-device protection.** Direct profile writes are disabled after migration, and every protected save must be based on the latest observed server revision before it can commit.
- **Cache-busted assets.** The deployment references a production build version so browsers do not keep running an old `app.js` after upload.
- **Owner backups.** Admin → Production Data Safety can export all durable database records to JSON. Supabase Storage file bytes remain a separate provider/storage backup responsibility.

## Required deployment order

1. In the existing Supabase project, open **SQL Editor**.
2. Run `supabase-schema.sql` in full. It contains the original non-destructive base schema followed by the production hardening migration.
   - For an already-complete base schema, `supabase-production-hardening.sql` can be run by itself.
   - The hardening migration is transactional and safe to run repeatedly.
3. Confirm the SQL completes without an error before uploading the website files.
4. Upload the **contents of this folder** to the live `/fantasy/` directory. Do not upload the outer folder.
5. Keep `index.html`, `app.js`, `styles.css`, and `config.js` together at the same level.
6. Sign in with the owner account and open **Admin → Tools → Production Data Safety**. Run the health check and complete the tests in `PRODUCTION-CHECKLIST.md`.

## Existing-data recovery behavior

On the first login after deployment, the app checks the user-specific browser save, its IndexedDB recovery mirror, the legacy `afterglowDatingV1` browser save, and the Supabase profile row. It combines nonempty profile fields, Vault answers, likes, unlocks, and current-week state, then performs a protected sync.

If the old browser data still exists, this build can recover and re-upload it. If both the Supabase row and all browser storage/backups were already erased before this build was installed, the missing historical answers cannot be reconstructed. Cloud revision history and server-observed weekly activity begin after the migration and the next successful protected sync.

Glow Coins found only in an older browser save are not automatically trusted as spendable currency. They are preserved in a local snapshot and submitted as a **wallet recovery request**. The owner can approve or reject that preserved balance in the Admin user wallet panel.

## Files

- `supabase-schema.sql` — complete install/upgrade script.
- `supabase-production-hardening.sql` — production migration only.
- `supabase-schema-base.sql` — preserved original non-destructive base schema.
- `PRODUCTION-CHECKLIST.md` — release verification steps.

## Supabase dormancy

A paused Supabase project cannot provide live cross-device cloud access while it is offline. This build keeps changes in localStorage plus IndexedDB, shows the degraded sync state, and retries when Supabase returns. It prevents an empty/stale response from replacing richer data, but it cannot keep the external service itself from pausing.
