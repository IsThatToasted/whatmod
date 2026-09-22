# JustGlance direct-static hosting (v2.0.0)

JustGlance remains compatible with the same single GitHub Pages workflow used by the rest of `whatmod.com`.
The `/life` directory contains browser-ready files, so Pages does **not** need a second web deployment workflow.

Production entry files:
- `index.html`
- `config.js`
- `app.js`
- `runtime/**`
- `styles.css`
- `manifest.webmanifest`
- `icons/**`

The existing `.github/workflows/web-pages.yml` injects these repository secrets into the deployed `_site/life/config.js`:

- `JUSTGLANCE_SUPABASE_URL`
- `JUSTGLANCE_SUPABASE_ANON_KEY`

Those are the public Supabase URL and publishable/anon key used by the browser client. Never put a service-role key in GitHub Pages output.

## Database upgrade

For v2, run these migrations in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_organizer_expansion.sql`

The second migration adds projects, project-linked tasks/events/notes, inbox/defer/waiting/energy fields, and reminders while preserving the original data model and RLS.

## iOS

The existing separate `justglance-ios-unsigned.yml` workflow remains responsible for building the unsigned IPA. The v2 wrapper adds a WKWebView bridge for native local reminders; it does not require another server or workflow.
