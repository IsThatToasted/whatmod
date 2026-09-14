# WhatMod Trivia V2 — Game UI

A GitHub-Pages-friendly daily estimation trivia + realtime multiplayer app designed for `https://whatmod.com/trivia/`.

## What is already implemented

- Static, dependency-free frontend that can live entirely under `/trivia`.
- Responsive desktop/mobile UI + installable PWA shell.
- Google login through Supabase Auth.
- Persistent profiles, XP, levels, wins, games played, and daily streaks.
- Daily numeric estimation challenge with 0–1,000 proximity scoring.
- Distribution graph that works well for Fermi-style answers spanning orders of magnitude.
- Lobby codes, join links, configurable category/difficulty/question count/timer/player cap.
- Realtime lobby/player updates for normal rooms.
- Secure server-side scoring: correct answers are never exposed before reveal.
- Round results, running scoreboards, final standings.
- OBS-friendly overlay route: `/trivia/?overlay=ABC123`.
- Twitch OAuth, post-lobby-to-chat, and EventSub WebSocket listener for `!trivia` / `!join`.
- Event/Twitch room option intended for reduced fan-out at large scale.
- Demo mode for testing the complete UI before Supabase is configured.

## Folder placement

Copy `trivia/` directly into the root of the `whatmod` repository:

```
whatmod/
  trivia/
    index.html
    styles.css
    config.js
    js/
    supabase/
    ...
```

No frontend build step is required, so it does not disturb other pages already hosted from the same repository.

The optional workflow in this package is a validation workflow only. It does not deploy or overwrite the rest of whatmod.com.

## Existing project upgrade

If V1 is already connected and working, run **`supabase/migrations/002_v2_existing_project_upgrade.sql`** once. It fixes the daily-question SQL, adds Google-name syncing, and preserves player-edited names.

For a completely new Supabase project, run the corrected `001_trivia.sql` and then `seed.sql`.

## 1. Supabase

Create a project, then run in SQL Editor:

1. `supabase/migrations/001_trivia.sql`
2. `supabase/seed.sql`

Open `config.js` and set:

- `supabaseUrl`
- `supabasePublishableKey`
- `demoMode: false`

Use the **publishable** key in the browser. Never put a secret/service-role key into GitHub Pages.

## 2. Google Auth

In Google Auth Platform, create a Web OAuth client.

Use your Supabase project's Google callback URL as the Google authorized redirect URI. In Supabase Auth > URL configuration, set the site URL / redirect allow-list to include:

- `https://whatmod.com/trivia/`
- your local development URL, if you use one

Enable Google under Supabase Authentication > Providers.

## 3. Make your account an admin

After signing in once, run this in Supabase SQL Editor, replacing the email:

```sql
update public.profiles p
set is_admin = true
from auth.users u
where p.user_id = u.id and u.email = 'YOUR_EMAIL';
```

The backend already includes `admin_add_question(...)`. The next UI phase can expose a full question-bank editor/importer without changing the schema.

## 4. Twitch (optional)

Create a Twitch developer application and add:

`https://whatmod.com/trivia/`

as an OAuth redirect URL. Put the Twitch Client ID in `config.js`.

The static client uses Twitch's browser-compatible OAuth flow and requests:

- `user:read:chat`
- `user:write:chat`

The host can then post the lobby to Twitch chat and subscribe to Channel Chat Message through EventSub WebSockets.

## Scaling notes

### Standard rooms
Use Supabase Realtime for lobby state, host phase changes, and player list updates. Answers themselves are database writes and are not broadcast individually.

### Event rooms
Do **not** mirror 20,000 player states through Presence or send each answer over Broadcast. This build already keeps answers off Realtime and limits the subscribed state to the `games` and `game_players` tables.

For a true 10K–20K concurrent production event, the next infrastructure step should be:
- remove per-player realtime subscriptions entirely in Event mode;
- poll aggregate counts/leaderboard snapshots every 1–3 seconds;
- use a dedicated ingestion/queue layer for burst answer writes if load testing shows Postgres contention;
- provision a Supabase tier / quota capable of the intended connection and request volume;
- load-test before advertising a hard 20,000-player guarantee.

## Local test

Because ES modules are used, serve the folder rather than double-clicking `index.html`.

From the repository root:

```bash
python -m http.server 8080
```

Then open:

`http://localhost:8080/trivia/`

Demo mode works without any backend keys.

## Security model

- `questions`, `game_questions`, `game_answers`, and `daily_attempts` are not directly readable from the browser.
- Phase-aware SECURITY DEFINER RPCs return only safe question fields.
- Scoring happens in Postgres, not in client JavaScript.
- XP/win updates happen in backend functions.
- Browser config contains only public/publishable credentials.
- RLS remains enabled.

## Recommended next build phase

1. Full admin question-bank UI with CSV/JSON bulk import and validation.
2. Scheduled question packs / themed daily weeks.
3. Friends/following, private profiles, achievements, badges.
4. Matchmaking queue by skill/category.
5. Team mode.
6. Host moderation: kick/ban, lock lobby, pause, late join.
7. Spectator mode.
8. Creator branding themes.
9. Anti-cheat heuristics and suspicious-response flagging.
10. Production Event-mode load testing and dedicated burst-ingest path.


## V2 changes

- Complete game-style UI overhaul across home, lobby, match, results, leaderboard and profile.
- New players begin at Level 0; Level 1 begins at 250 XP.
- Google full name/avatar auto-sync into the trivia profile until the player manually changes their display name.
- `digest()` removed from the daily selector; deterministic ordering now uses PostgreSQL built-in `md5(text)`, so no pgcrypto namespace issue occurs.
