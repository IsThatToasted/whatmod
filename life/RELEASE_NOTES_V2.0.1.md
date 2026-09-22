# JustGlance v2.0.1 — UI consistency fix

## Fixed

- Removed the persistent light-only inline styling from the direct-static `#root`. This was the root cause of mixed light/dark palettes where cards became dark while inherited text remained dark.
- Added a theme/contrast sweep for task cards, mood chips, context cards, project cards, notes, forms, dialogs, filters, planner controls, and other interactive surfaces.
- Made native form controls follow the active JustGlance theme instead of browser/OS defaults.
- Stabilized the desktop left navigation as a fixed 252 px rail so route changes and scrollbar differences do not resize the sidebar.
- Added stable scrollbar gutter behavior to reduce horizontal page movement between routes.

## Deployment rule

`/life` is published by the repository-wide `.github/workflows/web-pages.yml` workflow alongside the other WhatMod applications. Do not add or depend on a separate JustGlance web-build workflow. The iOS unsigned-IPA workflow is separate and may remain separate because it performs an Xcode build rather than publishing GitHub Pages.
