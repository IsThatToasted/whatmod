# JustGlance web recovery — v1.0.4

JustGlance now follows the same repository deployment model as the working projects on whatmod.com:

- Static projects such as WeTrack stay as repository files and are copied into the Pages artifact unchanged.
- Vite projects such as `/app` and `/life` are built inside the main Pages workflow.
- `app/dist` is overlaid into `_site/app`.
- `life/dist` is overlaid into `_site/life`.
- One `_site` artifact is deployed with `actions/deploy-pages`.

There is no bot commit, placeholder publication page, chained Pages deployment, or source TypeScript served to browsers.

## v1.0.4 recovery behavior

Earlier JustGlance builds registered a cache-first service worker under `/life/`. A registered worker survives repository deployments and can continue serving an older HTML shell or hashed bundle after the repository has been fixed.

v1.0.4 therefore:

1. does not register a new caching service worker;
2. runs a pre-boot cleanup for `/life/` service-worker registrations and `justglance-*` caches;
3. ships `/life/service-worker.js` as a self-unregistering kill switch for browsers that still check the old registration URL;
4. uses a dependency-free boot module that dynamically imports the React application;
5. displays startup failures on screen instead of leaving a blank white page;
6. uses `manifest.webmanifest`, matching the proven `/app` deployment naming pattern.

Once the live web baseline is confirmed stable, offline PWA shell caching can be reintroduced with a network-safe strategy.
