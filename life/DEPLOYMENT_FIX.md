# JustGlance deployment architecture — v1.0.3

JustGlance now uses the same site-wide GitHub Pages model as the existing WhatMod applications.

- Static applications such as **WeTrack** remain ordinary repository folders (for example `/track`) and are copied directly into the Pages artifact.
- Vite applications such as the existing `/app` are compiled during the single root Pages workflow and their `dist` output is copied into the matching public subdirectory.
- JustGlance now follows that exact Vite model: `life/dist/.` is copied into `_site/life/` before Pages is deployed.

There is no temporary publishing page, bot commit, chained workflow dispatch, or source HTML exposed at `/life/`.

## Required repository secrets

- `JUSTGLANCE_SUPABASE_URL`
- `JUSTGLANCE_SUPABASE_ANON_KEY`

The existing `/app` continues to use its existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` variables/secrets.

## GitHub Pages setting

Repository **Settings → Pages → Build and deployment → Source** must be set to **GitHub Actions**.

## Expected production output

The deployed `/life/index.html` must reference a hashed bundle such as:

`/life/assets/index-xxxxxxxx.js`

and these URLs must return 200:

- `/life/manifest.json`
- `/life/service-worker.js`
- `/life/build-info.json`
- `/life/icons/icon-192.png`
