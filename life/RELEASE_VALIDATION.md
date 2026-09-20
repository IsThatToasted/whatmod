# JustGlance 1.0.0 — Release Validation

Packaging date: 2026-09-20

Validated in the packaging environment:

- Full `src/` TypeScript source check passed using local TypeScript with temporary external-module stubs.
- Deterministic parser, recurrence, and relevance-engine test cases passed against compiled modules.
- All JSON files parse successfully.
- All GitHub Actions YAML files parse successfully.
- `ios/JustGlance/Info.plist` parses successfully.
- GitHub Pages base path is configured as `/life/` and application routing uses `HashRouter`.
- PWA manifest/start URL/scope and service-worker paths target `/life/`.
- Supabase frontend uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; no service-role credential is present.
- iOS wrapper includes the `justglance://auth-callback` URL scheme and loads `https://whatmod.com/life/`.

Packaging-environment limitation:

The package registry was not reachable reliably enough to complete `npm install`, so the actual Vite production bundle could not be generated in this environment. The included GitHub build workflow performs `npm install` followed by `npm run build`; that workflow should be treated as the final dependency-resolved compilation gate after the project is copied into the repository.
