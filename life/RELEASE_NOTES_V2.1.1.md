# JustGlance v2.1.1 — Direct Static Startup Hotfix

- Fixes the production startup failure requesting `/life/runtime/styles/global.css`.
- The direct-static runtime no longer imports CSS as an ES JavaScript module. `index.html` loads `/life/styles.css` directly.
- Moves the source CSS import into the Vite-only entry so future direct-static TypeScript emits cannot accidentally reintroduce the broken browser import.
- Bumps static asset query versions to `v=211` to bypass cached v2.1.0 entry modules.
- No database migration or workflow change is required.
- The shared repository `web-pages.yml` deployment remains unchanged.
