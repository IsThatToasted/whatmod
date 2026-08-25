# Save — production-hardening sandbox

Target web URL: `https://whatmod.com/save/`

This release **preserves the existing GitHub Pages + Supabase architecture**. The browser remains a static app under `/save/`; private Lithic operations remain in Supabase Edge Functions.

## What changed

- Google-only Supabase OAuth (email/password and magic-link UI removed)
- Existing funds, invite codes, unlock voting and virtual-card creation preserved
- Apple-quality responsive UI refresh with mobile safe areas and reduced-motion support
- External bank account linking + Lithic micro-deposit verification
- ACH contribution requests through a server-side Edge Function
- Payout requests back to a verified linked bank account
- Auto-save plans: weekly, biweekly, monthly; pause/resume/replace
- Hourly GitHub Action runner for due auto-save plans
- Immutable-style money movement lifecycle (`initiated → pending/processing → settled/failed/reversed/refunded`)
- Provider/idempotency references and webhook event deduplication
- Lithic webhook HMAC verification and settlement reconciliation
- Balance cache recalculated only from ledger entries after settlement
- Digital-wallet provisioning proxy for Lithic Apple Pay / Google Pay web push provisioning
- PWA cache narrowed to same-origin `/save/` shell assets so financial/API responses are not cached
- GitHub Action verifies the static app and packages a Pages artifact without taking over an existing repository Pages deployment

## 1. Existing Supabase schema

If this is a fresh database, run:

`save/supabase/schema.sql`

For the existing Save database, **do not reset it**. Run only:

`save/supabase/migrations/002_financial_hardening.sql`

The migration is additive/backward-safe and preserves current funds/cards/ledger records.

## 2. Google OAuth

Supabase Auth should remain configured as:

- Site URL: `https://whatmod.com/save/`
- Allowed redirect URL: `https://whatmod.com/save/`
- Google provider: enabled

Google OAuth web client:

- JavaScript origin: `https://whatmod.com`
- Redirect URI: `https://hqkiexffibcrpjkiavqg.supabase.co/auth/v1/callback`

## 3. Supabase Edge Function secrets

Rotate the Lithic sandbox API key previously shared in chat before continued use, then set:

```bash
supabase secrets set LITHIC_API_KEY="YOUR_ROTATED_SANDBOX_KEY"
supabase secrets set LITHIC_FINANCIAL_ACCOUNT_TOKEN="YOUR_LITHIC_FINANCIAL_ACCOUNT_TOKEN"
supabase secrets set LITHIC_WEBHOOK_SECRET="YOUR_LITHIC_EVENT_WEBHOOK_SECRET"
supabase secrets set LITHIC_ASA_WEBHOOK_SECRET="YOUR_LITHIC_ASA_SECRET"
supabase secrets set SAVE_AUTOPAY_CRON_SECRET="A_LONG_RANDOM_VALUE"
```

Optional if your card program requires an account token on card issuance:

```bash
supabase secrets set LITHIC_CARD_ACCOUNT_TOKEN="YOUR_ACCOUNT_TOKEN"
```

`LITHIC_FINANCIAL_ACCOUNT_TOKEN` is required for real Lithic sandbox ACH collection/payment calls. It is intentionally not guessed or hard-coded.

## 4. Deploy functions

```bash
supabase link --project-ref hqkiexffibcrpjkiavqg
supabase functions deploy lithic-card
supabase functions deploy money-movement
supabase functions deploy process-autopay --no-verify-jwt
supabase functions deploy lithic-webhook --no-verify-jwt
supabase functions deploy lithic-authorization --no-verify-jwt
```

`money-movement` and `lithic-card` require the signed-in user's Supabase JWT. `process-autopay` uses `SAVE_AUTOPAY_CRON_SECRET`. `lithic-webhook` and `lithic-authorization` authenticate Lithic using HMAC signatures.

## 5. Lithic event webhook

Create a Lithic Events API subscription pointing to:

`https://hqkiexffibcrpjkiavqg.supabase.co/functions/v1/lithic-webhook`

Subscribe at minimum to the applicable payment/financial-transaction update events and card-transaction update events for your program. Put the subscription signing secret in `LITHIC_WEBHOOK_SECRET`.

The webhook handler:

1. verifies `webhook-id`, `webhook-timestamp`, and `webhook-signature`
2. rejects stale/replayed invalid requests
3. stores the provider event ID once
4. reconciles payment state
5. writes a ledger entry only when a money movement reaches `settled`
6. recalculates the cached fund balance

## 5A. Real-time fair-share card authorization

Enroll this responder as the Lithic **AUTH_STREAM_ACCESS** endpoint for the program:

`https://hqkiexffibcrpjkiavqg.supabase.co/functions/v1/lithic-authorization`

The responder uses an atomic Postgres reservation function before approving debit authorizations. It checks both the group balance and the member's current spending limit, so simultaneous card attempts cannot both spend the same available dollars. Credit authorizations are approved, and balance inquiries return the member's available amount.

Configure Lithic's ASA HMAC secret as `LITHIC_ASA_WEBHOOK_SECRET`. If your program uses the same event secret for ASA and Events API, the function can fall back to `LITHIC_WEBHOOK_SECRET`.

## 6. Auto-save GitHub secret

In the `whatmod` repository, create the Actions secret:

`SAVE_AUTOPAY_CRON_SECRET`

Use the **same value** stored in Supabase. `.github/workflows/save-autopay.yml` checks due plans hourly. For a regulated production launch, moving this schedule to a dedicated backend/Supabase Cron is recommended, but the included workflow is functional for the current architecture and sandbox.

## 7. GitHub Pages / builds

The app remains a plain `/save` static site using only relative frontend paths, so your existing GitHub Pages deployment can continue unchanged.

`.github/workflows/save-build.yml`:

- syntax-checks the frontend
- checks for likely private secrets in the static source
- verifies required migrations/files
- builds `dist/save`
- uploads `save-pages-build` as a workflow artifact

It **does not call `deploy-pages`**, specifically to avoid hijacking or breaking the existing `whatmod` Pages publishing strategy.

## 8. Apple Pay and Google Pay

The UI now calls the `lithic-card` Edge Function for Lithic's web push-provisioning endpoint:

- Apple Pay → `APPLE_PAY`
- Google Pay → `GOOGLE_PAY`

The server-side integration is present, but the final wallet-provider handoff depends on your Lithic card program/BIN being enabled for Digital Wallet Provisioning and on the wallet-provider implementation/entitlements Lithic provides. The app will report the provider error instead of pretending the card was added.

For a native iOS app, Apple's in-app push provisioning also requires the Apple provisioning entitlement and additional native PassKit work. The current GitHub Pages app uses Lithic's web provisioning path so web functionality remains intact.

## 9. Payout meaning

"Pay me back" is modeled as an ACH `PAYMENT` to a verified external bank account. The server checks the user's refundable amount before creating the movement. A payout remains pending until provider settlement.

For a future debit-card funding rail, "refund to original payment method" should use that rail/provider's refund/reversal semantics rather than an ACH payout. Do not fake that behavior by inserting a negative ledger row client-side.

## Security rules

- Never put Lithic or Supabase service-role credentials in `config.js` or GitHub Pages.
- `config.js` contains only the Supabase **publishable** key.
- Browser values are never authoritative balances.
- Raw routing/account numbers are not persisted in Save tables.
- PAN/CVV are never persisted in Save tables.
- Financial writes are server-side and idempotency-aware.
- RLS remains enabled and is part of the authorization boundary.
