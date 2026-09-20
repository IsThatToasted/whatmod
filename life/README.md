# JustGlance

**Your life, at a glance.** A mobile-first personal daily operating system designed around fast capture and a dynamic NOW screen rather than a traditional task dashboard.

## Included in this build

- React 19 + TypeScript + Vite, configured for `https://whatmod.com/life/`
- Hash routing so GitHub Pages refresh/deep links remain reliable
- Responsive mobile bottom navigation and desktop sidebar/context layout
- NOW relevance engine using due time, priority, postponements, duration, time-of-day and temporary mood intent
- Universal natural-language capture with a modular `LifeIntentParser`
- LATER buckets, filters, completion, snooze, deletion, quick duration/context metadata
- Shared Spaces and shopping-oriented UI
- Universal search across items, places and events
- Places, profile/schedule preferences, light/dark/system appearance
- Morning/evening-aware NOW UI, Daily Reset surface and activity feed architecture
- Demo mode with persistent browser-local sample data
- Supabase Auth + live CRUD + realtime subscription architecture
- Full SQL schema, indexes, profile trigger, helper functions and RLS policies
- PWA manifest, service worker and offline shell
- Hidden `#/debug` diagnostics route
- Environment-safe config; no service-role key belongs in the frontend
- GitHub Actions build workflow that does not overwrite unrelated whatmod.com projects

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the Vite URL. With `VITE_DEMO_MODE=true`, the app opens directly with sample data. Set it to `false` after configuring Supabase if you want the auth screen/live database immediately.

## Supabase setup

1. Create a Supabase project.
2. In the SQL editor, run `supabase/migrations/001_initial.sql` once.
3. Copy `.env.example` to `.env.local` and set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
VITE_DEMO_MODE=false
```

4. In Supabase Auth URL settings add:
   - Production site URL: `https://whatmod.com/life/`
   - Redirect URL: `https://whatmod.com/life/`
   - Local redirect URL: `http://localhost:5173/life/` (and/or the exact Vite URL used locally)
5. For Google OAuth, enable Google under Auth Providers and configure its client credentials. No Google secret belongs in this repository.

The frontend only uses the anon/public key. RLS is the authorization boundary.

## Repository integration

This package is intended to become the contents of `/life` in the existing `whatmod.com` repository:

```text
whatmod/
  life/
    src/
    public/
    supabase/
    package.json
    ...
```

Run `npm run build` inside `/life`. Vite emits `/life/dist`. Your existing root Pages workflow should copy/merge that compiled output into the hosted `/life/` path. The included `github-workflow-example/justglance-build.yml` is a repo-root workflow example. Copy it to the existing repository’s root `.github/workflows/` folder if desired. It only builds and uploads an artifact because blindly deploying a standalone Pages artifact could erase sibling applications.

## Production build

```bash
npm install
npm run typecheck
npm run build
```

The app's Vite base is `/life/`, the PWA start URL/scope are `/life/`, and the service worker is registered at `/life/sw.js`.

## Data model

The migration includes `profiles`, `spaces`, `space_members`, `items`, `item_history`, `shopping_items`, `places`, `events`, `routines`, `notes`, `user_preferences`, `daily_summaries`, `activity_log`, `invites`, `notifications`, and `device_preferences`.

Personal records use `user_id`. Shared records may reference a `space_id`; helper functions check membership/admin role without trusting the browser. Personal spaces are never made public.

## Realtime

`items`, `shopping_items`, and `activity_log` are added to the Supabase realtime publication. The client maintains a compact subscription and silently refreshes on changes. Expand this selectively rather than subscribing to every table.

## Offline/PWA

The service worker caches the application shell and fetched GET resources. Demo/local state persists in `localStorage`. The provider exposes online/sync state and an offline banner. For a later production iteration, queued live Supabase mutations can be moved from the current optimistic architecture into IndexedDB for durable background retry.

## Feature architecture

`src/lib/flags.ts` centralizes feature flags. Provider abstractions can be added for AI, calendar and weather without coupling the UI to a vendor. The current parser and relevance engine are intentionally deterministic fallbacks, so JustGlance is useful with zero AI API keys.

## Security notes

- Never add a Supabase service-role key to Vite variables.
- Keep RLS enabled on every user-data table.
- Treat browser geolocation as opt-in.
- Do not log task/note contents to third-party analytics.
- Invite tokens should be hashed before storage; `invites.token_hash` is included for that architecture.

## Current intentional boundaries

Visible primary controls in this build work. Voice capture, web push, OAuth UI buttons, external calendar sync, true geofencing and live weather are not exposed as pretend-working primary features. The architecture/flags are ready for them, but they require provider credentials, browser permissions or server-side delivery infrastructure.

## Recommended next production passes

- Add durable IndexedDB mutation queue for live accounts.
- Add invite creation/acceptance UI using an Edge Function to hash/verify invite tokens.
- Add full item edit sheet and recurrence builder.
- Add browser notification/Push subscription flow after choosing a push delivery backend.
- Add a real weather provider and optional geolocation-based suggestions.
- Add test coverage for RLS in Supabase local development and browser E2E tests for the core two-minute onboarding/capture journey.

## Debug

Open `#/debug` to see connection mode, online/sync state, time context, feature flags and current relevance scores. It is intentionally absent from production navigation.
