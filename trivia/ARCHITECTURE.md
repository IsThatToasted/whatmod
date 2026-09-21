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

## V5 lobby synchronization

Standard lobbies use Postgres Changes on `games` plus INSERT/DELETE events on `game_players`. RLS membership checks are performed through `public.is_game_participant(uuid)` to avoid recursive policy evaluation. The client maintains a low-frequency authoritative RPC refresh as a self-healing fallback; when Realtime is healthy this is only a periodic health check, not the primary update mechanism.

## V6 community analytics

Numeric answer distributions do not retain a separate analytics event per player. Each question has one `question_answer_stats` row containing 41 logarithmic histogram counters spanning four orders of magnitude below/above the correct answer. Daily, Practice, and Party answer inserts increment this row through database triggers.

This makes the Community Answers visualization effectively constant-space per numeric question as participation grows.

## V6 Replay Library

`library_sessions` is a compact immutable-style manifest: an ordered `uuid[]` of existing question IDs plus searchable metadata and optional cover-image attribution. Question content is never duplicated into the snapshot. Identical ordered sets deduplicate through a fingerprint.

A Library replay creates a normal zero-XP Practice session from that manifest. Completed Practice internals may later be pruned without deleting the replay pack.

## V6 open-knowledge hydration

A GitHub Actions job runs the server-only `trivia/tools/wikidata-question-sync.mjs` importer. It reads public Wikidata data, enriches optional images with Wikimedia Commons attribution/license metadata, and upserts only selected/local-cache questions into Supabase by `canonical_key`. Images remain external URLs; no image blobs are stored in Supabase.

## V7 media resolver

Question media is now two-tiered:

1. `questions.image_*` contains the single image currently shown to players.
2. `question_media_candidates` stores compact alternate-provider metadata and moderation state.

A GitHub Actions resolver uses the server-only Supabase service role to search Wikimedia Commons/Openverse and update unlocked question media. `/triviaadmin/` uses browser-safe Supabase Auth plus admin-only RPCs; the service-role credential is never exposed to the browser.
