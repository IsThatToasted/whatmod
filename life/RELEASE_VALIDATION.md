# JustGlance v1.0.4 validation

Deployment architecture is unified with the repository's existing GitHub Pages workflow.

The Pages artifact is assembled as one site:

- repository static content -> `_site/`
- existing Vite `/app` -> `_site/app/`
- JustGlance `life/dist` -> `_site/life/`
- static apps such as WeTrack remain copied directly from their repository folders

The workflow rejects a JustGlance build if production HTML still references `/src/main.tsx`, if `/life/assets/` is missing, or if required PWA files are absent. A post-deploy smoke check verifies the live compiled bundle, manifest, and `build-info.json`.


## v1.0.5 direct-entry recovery
- Removed the asynchronous main.ts -> service-worker cleanup -> dynamic import bootstrap chain.
- Restored a normal Vite direct entry at src/main.tsx, matching the boot pattern used by the working apps.
- Legacy service-worker cleanup is non-blocking and never gates React mounting.
- Added an 8-second initial Supabase data timeout and pre-module boot diagnostics.
