# Aurelium Field

Aurelium Field is a mobile-first construction operations platform with painting-specific estimating and production at its core. The repository is designed to live at `whatmod/app/` and deploy the web product to `https://whatmod.com/app/` while the native SwiftUI app lives under `app/ios/`.

## Architecture

- **Web:** React 19 + TypeScript + Vite, static production output, hash routing for GitHub Pages.
- **PWA:** installable shell with network-first cache behavior and versioned cache cleanup.
- **Cloud:** Supabase Postgres/Auth/Storage/Realtime only for shared business data; schema begins in `supabase/migrations/001_initial.sql`.
- **iOS:** SwiftUI + RoomPlan + Speech. XcodeGen keeps the Xcode project reproducible from source.
- **AI:** server-only provider boundary in `supabase/functions/estimate-summary`. No provider secret is shipped to browsers or iOS.

## Repository placement

Copy this entire folder to:

```text
whatmod/
└── app/
    ├── src/
    ├── public/
    ├── supabase/
    ├── ios/
    └── ...
```

GitHub has one unavoidable exception: Actions only execute from the repository root `.github/workflows/` directory. Copy these two files from `app/.github/workflows/` to:

```text
whatmod/.github/workflows/web-pages.yml
whatmod/.github/workflows/ios-build.yml
```

The workflows still build only `app/` and `app/ios/`.

## Local web build

```bash
cd app
cp .env.example .env.local
npm install
npm run dev
```

Production check:

```bash
npm run build
```

## Supabase setup

This product genuinely requires shared data, accounts, permissions, media storage and collaboration. Create a Supabase project, run `supabase/migrations/001_initial.sql`, then configure repository **Variables** (these are public browser configuration, not secrets):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Never place a service-role key in the web or iOS app.

Recommended Auth providers: Apple and Google. Storage buckets should be private and served through signed URLs or authenticated fetches.

## Native iOS build

Locally:

```bash
cd app/ios
brew install xcodegen
xcodegen generate
open AureliumField.xcodeproj
```

The included GitHub workflow creates a **simulator build artifact without signing secrets**. For TestFlight/App Store distribution, add a separate signing/release job using App Store Connect credentials/certificates rather than embedding signing material in the repository.

## Smart Estimate design contract

The estimator treats captured measurements as evidence, not AI prose. Native iOS RoomPlan capture provides spatial geometry on supported devices. Narration is transcribed into timestamped notes. Generated scopes/line items are suggestions and must remain editable. Every derived quantity should retain:

- capture source (`roomplan`, `manual`, `derived`, `ai`)
- confidence when available
- verification status
- user who verified a measurement
- timestamp

This prevents an AI summary from silently changing field measurements.

## Current production foundation

Implemented in this first build:

- responsive navigation and design system
- operations dashboard
- project list/search surface
- Smart Estimate workspace on web
- field-tool launch surface
- team/scheduling foundation
- PWA manifest/service worker
- normalized Supabase schema with RLS
- estimate rooms, surfaces, line items, production rates and walkthrough notes
- project media, tasks, time entries, daily logs and messaging data models
- native SwiftUI shell
- native RoomPlan scanning flow
- native speech-to-text walkthrough notes
- reproducible iOS CI build
- GitHub Pages build/deploy workflow for `/app/`

## Next build slices

The architecture is intentionally ready for the next production modules without a rewrite: authentication/onboarding, organization provisioning, real CRUD, offline sync queue, photo timeline, painting production-rate engine, proposal/e-signature flow, CRM pipeline, crew scheduling/timecards, daily logs, RFIs/submittals/drawings, change orders, customer portal, push notifications, and AI provider integration.

## v0.2.0 Smart Walkthrough + Project CRUD

- Combined RoomPlan scanning and live speech transcription into one native walkthrough.
- Added high-contrast in-scan evidence capture: DAMAGE, REMOVE, DO NOT DISTURB, COVER, PAINT.
- Added local scan-video recording and a native video/evidence/transcript review screen.
- Added project search/selection at the top of Smart Estimate.
- Added native project create/edit/delete and walkthrough delete with media cleanup.
- Added web project create/edit/delete/search with durable local browser persistence.
- Added `002_walkthrough_scans.sql` for the cloud walkthrough/evidence model when account sync is wired.

### Current persistence boundary
The v0.2.0 UI is deliberately usable before authentication is finished: web project records persist in localStorage and native project/walkthrough metadata persists on-device, with scan media stored in the app Documents directory. The Supabase schema is ready for cross-device synchronization, but cloud sync should be enabled together with authenticated organization membership rather than bypassing RLS.
