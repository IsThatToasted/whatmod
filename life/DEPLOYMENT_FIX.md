# JustGlance deployment layout

JustGlance is a Vite application, but `whatmod.com` is a multi-project site. The repository must not serve the Vite source `index.html` directly.

The source HTML entry now lives at `life/vite/index.html`. `npm run build` writes the production bundle to `life/dist/`.

The repository-root workflow `.github/workflows/justglance-publish.yml`:

1. installs dependencies;
2. runs tests and the production build;
3. validates that `dist/index.html` contains compiled `/life/assets/...` references and no `/src/main.tsx` reference;
4. copies only JustGlance's compiled static output into the public `life/` root;
5. commits those generated files back to the repository.

This deliberately does **not** deploy the entire GitHub Pages site itself. Your existing whatmod.com Pages workflow/branch remains responsible for the domain, so sibling applications are not replaced by a JustGlance-only Pages artifact.

Required repository secrets:

- `JUSTGLANCE_SUPABASE_URL`
- `JUSTGLANCE_SUPABASE_ANON_KEY`

If repository branch protection prevents `github-actions[bot]` from pushing generated files to `main`, allow GitHub Actions write access or merge the build/copy steps into the site's existing deployment workflow instead.

## v1.0.2 Pages handoff fix

The JustGlance build workflow commits compiled files into `/life`. A commit created with the workflow `GITHUB_TOKEN` does not fire ordinary push-triggered workflows, so a separate GitHub Pages workflow can remain on the previous deployment even though the repository contains the new build.

`justglance-web-build.yml` now grants `actions: write` and explicitly dispatches `.github/workflows/web-pages.yml` after publishing the compiled `/life` files. This keeps the repository's existing whole-site deployment responsible for whatmod.com while ensuring the JustGlance build is included.

The temporary `/life/index.html` publication shell also reloads itself every 10 seconds. It is replaced by Vite's generated `dist/index.html` during a successful JustGlance build.
