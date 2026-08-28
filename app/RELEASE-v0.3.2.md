# Aurelium Field v0.3.2 — Supabase Build Configuration Fix

- Web GitHub Action now accepts `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from either repository Actions Variables or repository Actions Secrets.
- The web build now fails explicitly if either Supabase value is missing instead of deploying a production bundle with cloud auth disabled.
- Supabase URL format is validated before Vite builds.
- iOS workflow uses the same Variables-or-Secrets fallback.

If your values are stored only as **Environment-level** values under the `github-pages` environment, copy them to repository-level Actions Variables or Secrets so the build job can access them without requiring deployment-environment approval.
