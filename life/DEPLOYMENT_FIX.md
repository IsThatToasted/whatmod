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
