# Wisconsin Road Trip Planner

A fun, mobile-friendly, GitHub Pages-ready planner for the July 2–5 York, PA → Saukville, WI trip.

## Files
- `index.html` — app shell
- `styles.css` — road-trip dashboard styling
- `app.js` — planner, import/export, local save, Supabase sync
- `config.js` — your Supabase project URL and publishable key
- `supabase-schema.sql` — table + RLS policies

## Supabase setup
1. Open Supabase SQL Editor and run `supabase-schema.sql`.
2. In Supabase Auth → Providers, enable Google.
3. In Supabase Auth → URL Configuration, add your GitHub Pages URL to allowed redirect URLs, for example:
   - `https://YOURUSERNAME.github.io/YOURREPO/`
   - your custom domain if using one
4. Upload these files to GitHub Pages.

## Notes
The app still works without login using localStorage. Google login will not complete until Google provider credentials and Supabase redirect URLs are configured.
