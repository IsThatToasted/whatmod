# Afterglow Production Verification

Complete this after running `supabase-schema.sql` and deploying the updated static files.

## 1. Authentication and boot

- Sign out, hard-refresh, and sign in with Google.
- Confirm the age gate and existing login redirect still work at `https://whatmod.com/fantasy/`.
- Confirm the profile name/avatar load and the app does not show a blank profile.
- Confirm the Data Safety status says **protected cloud sync** after the first sync.

## 2. Vault persistence and recovery

- Answer at least three previously unanswered Vault prompts.
- Refresh the page, sign out/in, and verify the answers remain.
- Open the same account in another browser/device and verify the answers arrive from cloud sync. Change different answers on both devices, sync the newer device first, then confirm the stale device merges instead of overwriting it.
- Disconnect the network, change one answer, reconnect, and verify the queued sync completes.
- Download a personal JSON backup in the Data Safety panel. As the owner, also download a Server Backup and confirm it contains profiles, wallets, ledger, inventory, activity events, and album metadata.
- Restore the latest local copy and verify no answers disappear.
- Confirm cloud revisions appear after protected changes; restore one and verify the wallet remains unchanged.
- Clear only localStorage in browser developer tools, reload, and confirm the IndexedDB recovery mirror can restore the richer local copy before cloud sync.

## 3. Glow Coins and streaks

- Claim the daily gift once. A second claim on the same local calendar date must return **already claimed**.
- Verify a `daily_reward` entry exists in `fv_wallet_ledger` and the balance matches `fv_wallets`.
- Purchase an item and verify the wallet debit and inventory grant happen together.
- Refresh and confirm the balance, owned item, and equipped item remain unchanged.
- Confirm the streak resets to 1 after a missed day and increments across consecutive dates in the wallet timezone.
- If a legacy local balance is higher than the migrated server balance, confirm a pending wallet review appears in Admin instead of silently granting or deleting it.

## 4. Weekly goals

- Set a mood, upload a private album photo, answer three Vault prompts, and send a message.
- Verify each reward can be claimed only once for the current ISO week.
- Confirm the database refuses a weekly claim when its supporting action has not occurred. An unchanged old mood or old Vault answers must not become eligible from a plain profile resync.
- Confirm old completed goals do not display as completed after a new ISO week starts.

## 5. Profiles, matches, and messaging

- Verify Discover loads other users through the protected directory RPC.
- Confirm a nonmatched user cannot request a private album.
- Confirm a mutual match can request access; the owner can accept/deny; the permission remains after the request message expires.
- Confirm only the sender and recipient can sign private chat media URLs.
- Send a private photo, clear the conversation, and verify the sender-owned storage object is removed.
- Let a test message expire, revisit chat, and verify expired rows are pruned without exposing old media.

## 6. Admin and security

- Sign in as `ra1nonit1@gmail.com` and run the Production Data Safety health check.
- Verify normal users cannot open Admin tools.
- Verify the Admin wallet adjustment creates a ledger entry and cannot create a negative balance.
- Approve and reject a test wallet recovery request.
- In Supabase, confirm RLS is enabled on profile revisions, activity events, wallets, ledger, shop inventory, weekly claims, wallet recovery requests, album access, messages, and private album metadata.
- Confirm direct authenticated insert/update/delete privileges are absent for `fv_profiles`, profile revisions, activity events, wallet tables, inventory, album access, and wallet recovery requests.

## 7. Release acceptance

Release only when all of these remain true after a full refresh:

- Vault answers persist.
- Profile fields persist.
- Glow Coin balance matches the server wallet.
- Daily claim cannot duplicate.
- Weekly claims cannot duplicate.
- Purchased unlocks persist and cannot be forged through profile JSON.
- Private album and chat media are inaccessible without authorization.
- Data Safety personal export, Server Backup, local/IndexedDB recovery, cloud revision restore, and health check work.
