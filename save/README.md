# Save — Commitment Planner

Save coordinates shared goals using **commitments, planned expenses, reimbursements, and settlement tracking**. It does not hold, charge, refund, or transmit money.

## Deployment

- Frontend stays in `/save` for `https://whatmod.com/save/`.
- Google OAuth continues through the existing Supabase project.
- Supabase provides database/auth/realtime.
- GitHub Actions verifies and packages the static Pages artifact.
- All frontend asset paths remain relative for subfolder hosting.
- The PWA service worker uses network-first shell caching and never caches Supabase/financial API responses.

## Core product model

1. **Goals** — name, target amount, date, description.
2. **Commitments** — each member's promise: firm, flexible, or tentative.
3. **Expenses** — expected costs can be unassigned, claimed by one member, or split across the group.
4. **Reimbursements** — when someone fronts a real expense, Save calculates each member's share.
5. **Settlements** — members pay outside Save and record the transfer; the recipient confirms receipt.
6. **Auto Commit** — optionally grows a commitment weekly, biweekly, or monthly. It never charges a payment method.

## Existing database upgrade — current release

If you already have the previous **goal + expense UX v3** installed, run **only**:

```text
save/supabase/migrations/007_production_integrity.sql
```

Migration 007:

- repairs commitments that were incorrectly hidden when Auto Commit was disabled;
- permanently separates commitment visibility from Auto Commit scheduling;
- hardens scheduled Auto Commit processing;
- prevents unassigned paid expenses from creating empty reimbursements;
- keeps claimed-expense commitments large enough after an expense is edited upward;
- distinguishes reimbursement `sent` from recipient-confirmed `covered`;
- adds safe soft-removal for planned expenses.

Do **not** rerun `schema.sql` on an existing database.

### If you are upgrading from an older commitment build

Run missing migrations in order:

```text
005_commitment_repair_and_goal_delete.sql
006_goal_edit_and_expense_ownership.sql
007_production_integrity.sql
```

Migration 005 is self-contained for the commitment model, so you do not need to run 004 separately when using 005.

### Fresh Supabase project

For a brand-new empty project:

1. Run `supabase/schema.sql` once.
2. Run migrations `005`, `006`, and `007` in order.
3. Do not rerun `schema.sql` after the project is initialized.

## Auto Commit

Set a long random secret in Supabase:

```bash
supabase secrets set SAVE_AUTOCOMMIT_CRON_SECRET="YOUR_LONG_RANDOM_VALUE"
supabase functions deploy process-auto-commit --no-verify-jwt
```

Add the same value as a GitHub Actions repository secret:

```text
SAVE_AUTOCOMMIT_CRON_SECRET
```

`.github/workflows/save-auto-commit.yml` invokes the server-side Auto Commit worker hourly. Only commitments with an explicit amount, cadence, and due `next_build_on` are changed.

## Google OAuth

Keep:

- Supabase Site URL: `https://whatmod.com/save/`
- Supabase allowed redirect: `https://whatmod.com/save/`
- Google OAuth callback: `https://hqkiexffibcrpjkiavqg.supabase.co/auth/v1/callback`

The frontend intentionally supports Google sign-in only.

## Product boundary

Save never represents commitments as deposits or verified balances. Members keep their money wherever they already keep it and settle through any external method they agree on. Save stores only planning/accountability records.

## Legacy provider code

Older Lithic/PayPal migrations and Edge Function source remain for historical compatibility with prior development builds, but the current frontend does not invoke them and the GitHub build fails if those provider endpoints are reintroduced into `app.js`.
