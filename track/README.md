# Itinerary Tracker for GitHub Pages + Supabase

Static app intended for: `https://whatmod.com/track/`

## Files
- `index.html` — app shell
- `styles.css` — responsive dark UI
- `app.js` — Supabase auth + CRUD logic
- `schema.sql` — Supabase tables and RLS policies

## Supabase setup
1. Open Supabase SQL Editor.
2. Paste and run `schema.sql`.
3. Go to Authentication → URL Configuration.
4. Set Site URL to `https://whatmod.com/track/`.
5. Add Redirect URLs:
   - `https://whatmod.com/track/`
   - `https://whatmod.com/track`
6. Enable Google provider if using Google login, or use magic-link email login.

## GitHub Pages deployment
Place these files in a `/track` folder in your GitHub Pages repository so the final URL is:

`https://whatmod.com/track/`

The Supabase URL and publishable key are already configured in `app.js`.
