# JustGlance v2.0.0 validation

Validated in the release workspace:

- `life/app.js` passes `node --check`.
- Every committed `life/runtime/**/*.js` file passes `node --check`.
- Every relative JavaScript import in the committed runtime resolves to an existing file.
- The committed browser runtime contains no unsafe direct `import.meta.env.*` lookups.
- `.github/workflows/web-pages.yml` parses as YAML.
- `.github/workflows/justglance-ios-unsigned.yml` parses as YAML.
- Required organizer runtime pages/context and Supabase migration are present.
- Web/source/iOS release metadata is synchronized to v2.0.0.

A clean TypeScript `tsc --noEmit` pass was not available in the release workspace because the npm dependency install could not complete there. The repository keeps pinned source dependencies and the normal `npm run typecheck`, `npm run test`, and `npm run build` commands for CI/developer validation. The deployed direct-static JavaScript runtime was validated independently as listed above.
