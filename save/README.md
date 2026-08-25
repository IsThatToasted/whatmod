# Save — shared savings sandbox

Target URL: `https://whatmod.com/save/`

This package is intentionally split into:

- Static GitHub Pages frontend (`index.html`, `app.js`, `styles.css`)
- Supabase Postgres + RLS (`supabase/schema.sql`)
- Server-side Lithic sandbox adapter (`supabase/functions/lithic-card`)

## 1. Put the folder in the repo

Copy the contents of this `save/` directory to the root-level `save/` directory of `IsThatToasted/whatmod`.

The frontend is already configured with the supplied Supabase project URL and **publishable** key. A publishable key is expected to be browser-visible and must be protected by RLS.

## 2. Create the database

In the Supabase SQL Editor, run:

`save/supabase/schema.sql`

This creates profiles, funds, memberships, contribution-plan metadata, ledger entries, unlock voting, card metadata, card transactions, helper RPCs, RLS policies, and realtime publication entries.

## 3. Configure Auth URLs

In Supabase > Authentication > URL Configuration:

- Site URL: `https://whatmod.com/save/`
- Redirect URL: `https://whatmod.com/save/`

Email/password and magic-link login are supported by the frontend.

## 4. Store the Lithic key server-side

**Do not put the Lithic key in `config.js`, GitHub, browser JavaScript, or a GitHub Pages secret expecting the browser to hide it.**

Set it as a Supabase Edge Function secret:

```bash
supabase secrets set LITHIC_API_KEY="YOUR_ROTATED_LITHIC_SANDBOX_KEY"
```

The key supplied in chat is intentionally not written anywhere in this package.

Because the sandbox key was pasted into a conversation, rotating it in Lithic before continued development is recommended.

## 5. Deploy the Edge Function

```bash
supabase link --project-ref hqkiexffibcrpjkiavqg
supabase functions deploy lithic-card
```

The function validates the signed-in Supabase user, verifies fund membership, calls Lithic sandbox, and persists only the Lithic card token plus safe display metadata. It does **not** persist PAN or CVV.

## Current sandbox behavior

Working app flows:

- Sign up / sign in / magic link
- Create shared goal
- Join by invite code
- Fund goal/progress dashboard
- Equal-share initialization
- Personal spend-power display
- Sandbox contribution ledger
- Fund spending modes
- Unlock-funds requests
- Majority, unanimous, or organizer approval
- Automatic increase to requester's spend limit when approved
- Fund member list
- Recent ledger activity
- Lithic sandbox virtual-card creation through Edge Function
- PWA shell / installable web app basics

Intentionally not wired to real money yet:

- ACH or debit funding
- recurring bank pulls
- real card authorization webhooks
- production account holders
- Apple Pay / Google Pay provisioning
- withdrawals / settlement to external accounts

Those require the approved Lithic/banking program structure and production tokenization/funding setup. The database contains `contribution_plans` so recurring saving can be attached without redesigning the core model.

## Important production rule

Never treat the `current_balance_cents` field as an authoritative bank balance in production. Once real funds are enabled, provider ledger/webhook events should be the source of truth, with idempotent reconciliation into `ledger_entries` and the cached balance.
