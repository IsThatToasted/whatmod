
## Existing Supabase database: important

If Save is already installed, **do not run `supabase/schema.sql` again**. That file is the first-install bootstrap and may collide with RLS policies that already exist.

For the commitment build, run only:

```sql
save/supabase/migrations/005_commitment_repair_and_goal_delete.sql
```

Migration 005 is intentionally safe for the existing project: it creates the commitment tables/RPCs if missing, refreshes only the commitment-era read policies, preserves existing fund/profile data, and adds owner-only goal deletion.

# Save — Commitment Planner

Save now uses a **promise-to-pay / commitment model**. It coordinates shared goals without holding, charging, refunding, or transmitting money.

## Deployment preserved

- Static frontend remains in `/save` for `https://whatmod.com/save/`.
- Google OAuth continues through the existing Supabase project.
- Supabase remains the database/auth/realtime backend.
- GitHub Actions verifies and packages the static Pages artifact.
- Relative asset paths and the PWA service worker remain compatible with GitHub Pages subfolder hosting.

## Core model

1. **Goals** — expected total and date.
2. **Commitments** — each member's promised amount: firm, flexible, or tentative.
3. **Plans** — expected expenses reserve portions of commitments.
4. **Funding Calls** — once a member actually fronts an expense, Save calculates what each member is responsible for.
5. **Settlements** — members pay outside Save (Venmo, Zelle, PayPal, Apple Cash, cash, bank transfer, etc.) and record/confirm fulfillment.
6. **Auto Commit** — optionally grows a promise on a weekly, biweekly, or monthly schedule. It never charges a payment method.

## Upgrade an existing Save database

Do **not** reset the existing Supabase database.

Run the additive migration in the Supabase SQL editor:

```text
save/supabase/migrations/004_commitment_model.sql
```

Existing financial/Lithic/PayPal tables are intentionally left intact for data safety and historical compatibility, but the new frontend does not depend on them.

## Deploy Auto Commit

Create a long random secret and set it in Supabase:

```bash
supabase secrets set SAVE_AUTOCOMMIT_CRON_SECRET="YOUR_LONG_RANDOM_VALUE"
supabase functions deploy process-auto-commit --no-verify-jwt
```

Add a GitHub Actions repository secret with the **same value**:

```text
SAVE_AUTOCOMMIT_CRON_SECRET
```

`.github/workflows/save-auto-commit.yml` checks hourly for due commitment-growth schedules. The server-side RPC updates the commitment and audit event atomically. No payment provider is called.

## Google OAuth

Keep your existing Google/Supabase setup:

- Supabase Site URL: `https://whatmod.com/save/`
- Supabase allowed redirect: `https://whatmod.com/save/`
- Google OAuth callback: `https://hqkiexffibcrpjkiavqg.supabase.co/auth/v1/callback`

The UI intentionally supports Google sign-in only.

## Important product boundary

Save does not represent commitments as deposits or verified funds. It never asks users to enter bank/card credentials and does not claim money is reserved at a financial institution. A commitment is a social/planning promise; fulfillment happens outside Save.

## Legacy financial integrations

The prior Lithic and PayPal Edge Functions/migrations remain in the repository only so an existing deployment is not destructively altered. The old AutoPay GitHub workflow has been removed. The commitment UI does not invoke those integrations.
