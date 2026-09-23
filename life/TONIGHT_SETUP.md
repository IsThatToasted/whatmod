# JustGlance v2.3.0 — Tonight setup

This upgrade is additive. Keep using the existing `/life` app while development continues; migration 005 does not delete existing tasks, projects, shopping data, spaces, events, captures, links or notes.

## 1. Keep the working GitHub Pages deployment

`/life` continues to publish through the repository-wide `.github/workflows/web-pages.yml` alongside the other WhatMod apps. Do not enable or depend on `justglance-web-build.yml`.

The browser still uses only these existing GitHub repository secrets:

- `JUSTGLANCE_SUPABASE_URL`
- `JUSTGLANCE_SUPABASE_ANON_KEY`

## 2. Run migration 005

If your existing database already has the previous JustGlance migrations/repairs, run only:

`supabase/migrations/005_contacts_universal_memory.sql`

Its final diagnostic should report all values `true`:

- `contacts_ready`
- `item_contact_ready`
- `event_contact_ready`
- `capture_ai_ready`
- `contacts_auth_ready`

## 3. Optional but strongly recommended: turn on photo intelligence

The photo itself saves safely even without AI. To let JustGlance understand images and automatically organize clear captures, configure the included authenticated Edge Function.

Store the API key in **Supabase Function secrets**, never in the web app or GitHub Pages:

```bash
supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

Optional model override:

```bash
supabase secrets set JUSTGLANCE_AI_MODEL=gpt-5.6-luna
```

Then deploy:

```bash
supabase functions deploy smart-intake
```

Leave JWT verification enabled. The source is:

`life/supabase/functions/smart-intake/index.ts`

If this function is not configured or temporarily fails, the original photo/file remains in JustGlance and can be analyzed later from Memory.

## 4. Deploy normally

Merge/copy this release into the existing `/life` directory, inspect `git status`, and push. No `.github` workflow change is needed.

## 5. Start using it immediately

- Open **Capture → Take photo** and photograph something you want to remember. Text is optional.
- Open **More → Contacts** and create people you frequently refer to.
- Try `call Ashley for something next Tuesday` after Ashley has a mobile number.
- Open **Planner** to see the call and use **Dial**.
- Open **Memory** to find the original captures even after they have been turned into structured actions.
- Import an exported `.vcf` file from another address book if desired.
