# Wisconsin Trip Planner

Static GitHub Pages trip planner for July 2–5, 2026 from 700 Fireside Rd, York PA to Saukville, WI.

## Run locally
Open `index.html` directly, or run:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## GitHub Pages
Upload these files to your repo root or `/docs`, then enable GitHub Pages.

## Supabase + Google Login
1. Create a Supabase project.
2. In SQL Editor, run `supabase-schema.sql`.
3. Enable Google provider in Authentication > Providers.
4. Add your GitHub Pages URL and local URL to Authentication > URL Configuration > Redirect URLs.
5. Rename `config.example.js` to `config.js` and fill in:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

The planner works without Supabase using browser local storage.
