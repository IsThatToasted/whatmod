# JustGlance 1.0.1 — Deployment Fix Validation

Packaging date: 2026-09-20

## Fixed in 1.0.1

- Corrected the earlier strict TypeScript Supabase Realtime cleanup issue.
- Corrected the GitHub Pages white-screen deployment failure where `/life/index.html` was the Vite source entry and requested `/src/main.tsx` directly.
- Moved the Vite HTML source entry to `life/vite/index.html` so the public `life/index.html` can safely be generated production output.
- Added repository-root `.github/workflows/justglance-web-build.yml` that builds, verifies, and publishes only JustGlance generated files into `/life`.
- Preserved the existing whatmod.com Pages deployment rather than deploying a competing whole-site artifact.
- Added the modern `mobile-web-app-capable` meta tag while retaining the Apple compatibility tag.
- Service-worker registration now uses Vite `BASE_URL`.
- Separated Vitest config from the Vite root so tests remain discoverable under `life/src`.

## Static validation completed

- All JSON files parse successfully.
- Both repository-root GitHub Actions YAML files parse successfully.
- iOS `Info.plist` remains valid.
- The Vite source entry exists at `life/vite/index.html` and points to the real `life/src/main.tsx` source.
- The public fallback `life/index.html` no longer requests `/src/main.tsx`.
- The publishing workflow requires `dist/index.html`, `dist/manifest.json`, `dist/service-worker.js`, and `dist/assets` before publishing.
- The publishing workflow explicitly rejects a generated `dist/index.html` that still contains `/src/main.tsx`.
- The publishing workflow explicitly requires `/life/assets/` references before it commits generated output.
- No `.env.local`, service-role key, or other private Supabase secret is included in this package.

## Packaging-environment limitation

This execution environment cannot resolve `registry.npmjs.org`, so dependencies cannot be installed here and the revised Vite bundle cannot be generated locally. Your GitHub runner has already demonstrated dependency installation/build capability; the included workflow performs the real dependency-resolved `npm test` and `npm run build` before it publishes anything.
