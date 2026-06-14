# Wisconsin Road Trip Planner

Static GitHub Pages trip planner for July 2–5 from York, PA to Saukville, WI.

## New in this version

- Drag and drop events into different hour rows.
- Dropped events auto-update their start and end time while keeping the same duration.
- Double-click any empty hour to add a new event there.
- Click any event to edit title, start/end, address/place/link, and notes.
- Address/location chips open in Google Maps.
- All visible planner times use 12-hour AM/PM labels, not 24-hour labels.
- Changes save locally immediately and auto-save to Supabase per signed-in user.
- Supabase client is exposed as `window.tripSupabase` for quick browser-console debugging.

## Files

- `index.html` — app shell
- `styles.css` — visual design
- `app.js` — planner behavior and Supabase sync
- `config.js` — live Supabase project config
- `config.example.js` — safe template
- `supabase-schema.sql` — table + RLS policies

## Supabase setup

Run `supabase-schema.sql` in the Supabase SQL editor.

Google provider callback URL in Google Cloud:

```text
https://datpvcccejwgjavcytbx.supabase.co/auth/v1/callback
```

Supabase Auth URL Configuration should include your hosted app URL, for example:

```text
https://whatmod.com/wisconsin-trip-planner/
```

## Hosting

Upload all files in this folder to your GitHub Pages folder/repo path, or serve them from:

```text
https://whatmod.com/wisconsin-trip-planner/
```
