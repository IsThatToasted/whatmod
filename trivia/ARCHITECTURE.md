# Architecture

Browser / GitHub Pages
  -> Supabase Auth (Google)
  -> Postgres RPC (authoritative scoring, lobbies, daily challenge)
  -> Supabase Realtime (only game shell + player list for standard rooms)
  -> Twitch Helix + EventSub WebSocket (optional host integration)

Correct answers stay server-side until a game is in `results` or `finished`.

## Large event mode
Large rooms should not use Presence for each viewer and should not broadcast every answer.
Clients submit answers as ordinary RPC writes; the host/viewers consume aggregate snapshots.
A dedicated burst-ingest/queue service can be inserted later without replacing the UI or data model.
