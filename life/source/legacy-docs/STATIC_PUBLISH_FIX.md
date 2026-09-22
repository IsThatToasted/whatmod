# JustGlance v1.0.6 — Static Publish Fix

This release changes only the web publication shape, not the product architecture.

## Why

The working WhatMod subdirectory apps use browser-ready files directly in their public folders:

- WeTrack: `index.html` -> `app.js` / `styles.css`
- Trivia: `index.html` -> `js/app.js` / `styles.css`

Earlier JustGlance releases depended on Vite-generated hashed assets such as `/life/assets/index-<hash>.js`. That introduced a deployment-state mismatch: an HTML file from one publish could point at an asset tree from another publish, or a repository-tree deployment could expose the Vite source entry instead of the compiled bundle.

## v1.0.6 runtime shape

The workflow compiles the React/TypeScript source, but publishes deterministic relative files:

```text
life/index.html
life/app.js
life/styles.css
life/manifest.webmanifest
life/icons/
```

The source template is now `life/vite/index.html`; it is not the public runtime page.

The site-wide Pages workflow also writes the compiled browser-ready output back into `/life` on `main` when repository permissions allow it. This keeps `/life` safe even if another deployment later copies the repository tree directly.

## Supabase

The deployment now fails early if the URL/key secrets are missing or if the URL does not look like a Supabase project URL. The runtime Supabase constructor is also guarded so malformed frontend configuration cannot crash the entire JavaScript module graph before React mounts.
