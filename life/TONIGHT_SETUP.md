# JustGlance v2.1.0 — Tonight setup

This release is designed to upgrade an existing v2.0.x database without deleting or replacing existing user data.

## 1. Supabase migration

If JustGlance already has migrations 001 and 002, run only:

`supabase/migrations/003_shared_spaces_smart_intake.sql`

Migration 003 is additive. Existing shared members keep full category access initially so current behavior is preserved until you explicitly narrow permissions.

For a brand-new Supabase project, run 001, then 002, then 003.

## 2. Confirm the existing GitHub secrets

The shared `.github/workflows/web-pages.yml` deployment reads these repository Actions secrets:

- `JUSTGLANCE_SUPABASE_URL`
- `JUSTGLANCE_SUPABASE_ANON_KEY`

Do not put a Supabase service-role key in the browser app.

If either public secret is missing, the deployed app intentionally falls back to demo mode. In v2.1, Spaces displays **Demo mode** or the real signed-in email so this is immediately visible.

## 3. Deploy only `/life`

Apply this release to the repository's `/life` directory, inspect `git status`, then commit and push. Do not add a separate JustGlance Pages workflow. The existing shared `web-pages.yml` publishes `/life` together with the other WhatMod apps.

## 4. Quick smoke test

After deployment:

1. Sign in with a real Supabase account.
2. Open **Spaces** and confirm the account strip says **Signed in** with your email, not **Demo mode**.
3. Create a non-personal shared space.
4. Open it and create an invite link.
5. Create a named shopping list and add an item.
6. Use **Capture** with `Dentist Thursday at 2:30 PM at Aspen Dental` and confirm it proposes an appointment.
7. Import a small `.ics` or Outlook-style calendar `.csv` in **Planner**.
8. Attach an image or file in **Capture** and confirm it appears in the Smart Capture inbox.

