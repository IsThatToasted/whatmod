# BondQuest — Relationship RPG Test App

This folder replaces the old Wisconsin trip planner path with a static GitHub Pages web app.

## Features

- Relationship RPG dashboard with XP, levels, streaks, and relationship stats
- Quest board with generated and custom quests
- DistanceSync milestones, visits, gift tracking, travel goals, and bucket list items
- Consent-first bedroom compatibility builder that only reveals mutual overlaps
- Memory Vault for relationship artifacts and notes
- Long-distance date generator
- Couples heat map / mood logging
- Local storage fallback
- Supabase auth and per-user cloud sync

## Files

- `index.html` — app shell
- `styles.css` — app styling
- `app.js` — app behavior and Supabase sync
- `config.js` — live Supabase config from the original folder
- `config.example.js` — safe template
- `supabase-schema.sql` — table and RLS policies

## Supabase setup

Run `supabase-schema.sql` in the Supabase SQL editor.

The app stores one JSON document per user/app in `public.bondquest_apps`.

Make sure Supabase Auth URL Configuration includes your GitHub Pages path, for example:

```text
https://whatmod.com/wisconsin-trip-planner/
```

The app also works locally without login using browser localStorage.
