# JustGlance

**Your life, at a glance.**

JustGlance is a production-oriented React/TypeScript personal daily operating system designed to surface a small number of useful actions based on time, urgency, context, shared spaces, and user intent. The primary interface is **NOW**, not a traditional task dashboard.

## Included in this release

- Responsive mobile-first React + TypeScript + Vite application
- GitHub Pages-safe `/life/` base path and hash routing
- Supabase email/password, magic-link and Google auth architecture
- Automatic profile/personal-space database trigger
- Short onboarding flow
- Universal natural-language capture with non-AI fallback parser
- Configurable relevance scoring and time-context engine
- NOW, LATER, Spaces, shared shopping/tasks, Search, You and Settings
- Realtime-ready shared data subscriptions
- Offline shell, optimistic local state and mutation queue architecture
- Light/dark/system theme support and reduced-motion handling
- Full SQL migration with RLS, helper functions, hashed invite tokens and indexes
- PWA manifest/icons; legacy service-worker recovery kill switch
- Isolated demo mode that never writes demo records into production accounts
- Development-only debug page (`/#/debug` in dev, or add `?debug=1`)
- Native iOS SwiftUI/WKWebView wrapper and unsigned IPA GitHub Actions workflow

## Folder placement

Copy this complete directory into the existing `whatmod.com` repository as:

```text
/life
```

The Vite base, manifest and auth callbacks are written for `https://whatmod.com/life/`. v1.0.4 temporarily disables active PWA caching while it removes legacy `/life/` workers from earlier broken deployments.

> This ZIP is a **repository-root drop-in**: it contains `/life` plus repository-root `.github/workflows` files. Extract/copy both into the whatmod.com repository. The site-wide Pages workflow builds both Vite applications (`/app` and `/life`) and assembles one `_site` artifact while preserving static sibling applications such as WeTrack under `/track`.

## Requirements

- Node.js 22+
- npm
- A Supabase project for production accounts/data
- Xcode/GitHub macOS runner only for the optional iOS build

## Local web development

```bash
cd life
cp .env.example .env.local
npm install
npm run dev
```

Open the Vite URL shown in the terminal. Without valid Supabase environment variables the app automatically runs in isolated demo mode so the complete UI remains inspectable.

## Environment variables

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
VITE_DEMO_MODE=false
VITE_APP_VERSION=1.0.3
```

Only the public Supabase anon key belongs in the frontend. **Never** put a Supabase service-role key in this repository or in any `VITE_` variable.

For GitHub Actions, add repository secrets:

- `JUSTGLANCE_SUPABASE_URL`
- `JUSTGLANCE_SUPABASE_ANON_KEY`

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/migrations/001_initial_schema.sql` once, or use the Supabase CLI migration workflow.
3. In Authentication > URL Configuration set your Site URL to `https://whatmod.com/life/`.
4. Add redirect URLs:
   - `https://whatmod.com/life/`
   - `justglance://auth-callback` (native iOS OAuth/magic-link return)
   - your local Vite URL, e.g. `http://localhost:5173/life/`
5. Enable Email auth. Enable Google only after configuring the Google provider in Supabase.
6. Confirm Realtime includes `items`, `shopping_items`, `activity_log` and `space_members`; the migration attempts to add them safely.
7. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Security model

RLS is enabled for every user-data table. Access is restricted to the authenticated owner or a member of the relevant shared space. Personal spaces are created with `is_personal=true` and the invite-consumption function explicitly refuses to share them. Space invite tokens are stored as SHA-256 hashes; only the caller receives the raw invite token.

Shared member profile visibility is limited to users who share a space. Private places remain owner-only. The frontend never receives a service-role credential.

## Authentication behavior

Supported architecture:

- Email + password
- Magic link
- Google OAuth
- Password reset
- Session persistence/refresh
- Logout
- Profile and Personal space creation by database trigger

The expected web callback is `https://whatmod.com/life/`. The iOS wrapper uses PKCE with `justglance://auth-callback`, then hands the code back to the same WKWebView session for exchange.

## Routing / GitHub Pages

The app uses `HashRouter`, so application routes render as `https://whatmod.com/life/#/now`, `#/later`, etc. This avoids broken refreshes on GitHub Pages. `public/404.html` is also supplied as a defensive fallback.

## PWA and offline model

`public/service-worker.js` is currently a recovery kill switch: it clears old JustGlance caches and unregisters itself. This deliberately removes service-worker caching from the recovery release so stale Pages bundles cannot control startup. The client-side offline snapshot and mutation queue still protect captured data; PWA caching can be re-enabled after the hosted baseline is confirmed stable.

This is intentionally an **offline architecture**, not a claim of perfect multi-device conflict resolution. Before introducing complex collaborative editing, add explicit row versioning/merge policy rather than silently overwriting concurrent edits.

## Demo mode

Set `VITE_DEMO_MODE=true`, or omit Supabase variables locally. Demo data is generated only inside the frontend and uses reserved fake UUIDs. `supabase/seed_demo.sql` does not insert records into real accounts.

Sample content includes dentist call, package return, groceries, trash, air filter, a shared Home space and an evening event.

## Relevance engine

`src/lib/relevance.ts` contains the configurable deterministic scoring engine. Current factors include:

- due today / due soon / overdue
- high priority
- estimated quick wins
- snooze history
- recent capture
- current-place relevance
- time-inappropriate penalties (for example, calls outside normal daytime hours)
- temporary mood/intention boost

The NOW view receives scored results and normally surfaces only the top few items.

## Natural-language parser / future AI

`LifeIntentParser` is a local deterministic parser for type, due date/time, priority, common stores, duration hints and confidence. Parsing failures never block capture.

`providers/AIProvider.ts` defines the future-provider contract:

- `parseIntent()`
- `rankItems()`
- `summarizeDay()`
- `estimateDuration()`
- `suggestActions()`

The fallback implementation works without any AI key or external service.

## Weather and calendar integrations

Provider interfaces live in `src/providers`. V1 does not require a paid weather service or external calendar. Disabled/demo providers prevent unavailable integrations from breaking the primary experience.

## GitHub Actions

### Web build and monorepo publishing

The repository-root `.github/workflows/web-pages.yml` is the **single owner of GitHub Pages deployment**. It follows the same model already proven by the existing Vite `/app` project:

1. build `/app` to `app/dist`
2. build JustGlance to `life/dist`
3. copy ordinary static repository content (including WeTrack `/track`) into `_site`
4. overlay `app/dist/.` into `_site/app/`
5. overlay `life/dist/.` into `_site/life/`
6. deploy that one `_site` artifact with `actions/deploy-pages`

This means the repository source file `life/index.html` is never served directly in production. GitHub Pages receives only the compiled Vite output for `/life`. There is no publishing placeholder, generated-file bot commit, or chained workflow dispatch.

`.github/workflows/justglance-web-build.yml` is intentionally validation-only; it does not deploy Pages. See `DEPLOYMENT_FIX.md` for the final deployment model.

### iOS unsigned IPA

`/.github/workflows/justglance-ios-unsigned.yml` is already included at repository root in this package. It builds `life/ios/JustGlance.xcodeproj` on `macos-15`, disables signing, packages `Payload/JustGlance.app`, and uploads `JustGlance-unsigned.ipa` as a workflow artifact for sideload testing.

The native app loads `https://whatmod.com/life/`. Deploy the web build before testing a new native wrapper build.

## iOS project

Open:

```text
life/ios/JustGlance.xcodeproj
```

The wrapper provides:

- persistent WKWebView storage/cookies
- back/forward gestures
- inline media support
- external URL handling
- native location/microphone/speech permission descriptions for future opt-in features
- offline status overlay

The current deployment target is iOS 17.0 and the bundle identifier is `com.whatmod.justglance`.

## Build validation

```bash
npm run typecheck
npm run test
npm run build
```

The production build must complete with no TypeScript errors before deployment.

## Feature flags

`src/lib/config.ts` currently defines:

- `AI_PARSING`
- `LOCATION`
- `CALENDAR_SYNC`
- `PUSH_NOTIFICATIONS`
- `WEATHER`
- `SMART_SUGGESTIONS`
- `DAILY_RESET`
- `MORNING_BRIEF`

Keep unavailable features hidden or clearly disabled rather than exposing dead primary controls.

## Important production follow-ups

Before public launch, finish the provider-specific steps that cannot be safely embedded in source code: create the Supabase project, set auth redirect URLs, configure Google OAuth if desired, choose notification infrastructure before enabling push, and publish Privacy Policy/Terms destinations. The JustGlance build is already integrated into the site-wide whatmod.com Pages assembly workflow in this package.

## Architecture map

```text
src/
  components/        reusable UI and capture shell
  contexts/          auth + application data/realtime/offline state
  lib/               parser, relevance, time, config, offline queue, demo data
  pages/             NOW, Later, Spaces, Search, You, Settings, Auth, Onboarding
  providers/         AI, Calendar and Weather abstractions
  styles/            design system + responsive layout
supabase/
  migrations/        schema, functions, triggers, RLS, realtime publication
public/               Manifest/icons, recovery service-worker kill switch, 404 fallback
ios/                  SwiftUI/WKWebView native wrapper
.github/workflows/    workflow templates to copy to repository root
```

## Product rule

Every screen should answer: **Can someone understand what matters within one glance?** If not, simplify it.

## Monorepo publishing note (v1.0.4)

JustGlance uses the same site-wide Pages artifact model as the rest of whatmod.com. Static apps such as WeTrack are copied directly from the repository, while Vite apps are compiled and overlaid from `dist`. `/life` is therefore always deployed from `life/dist`, never from the source tree.
