# Trivia V5 — Realtime Lobby Sync

This upgrade fixes lobby rosters that only reflected the players present when a client first entered the room.

## Existing project

1. Replace the app files with the V5 drop-in package. Do **not** overwrite your existing `trivia/config.js`.
2. Run `supabase/migrations/005_realtime_lobby_sync.sql` once in Supabase SQL Editor.
3. Push the files and refresh the site.

## What changed

- Replaced the recursive `game_players` RLS policy with a non-recursive `SECURITY DEFINER` membership helper.
- Reasserted `games` and `game_players` in the `supabase_realtime` publication.
- Enabled `REPLICA IDENTITY FULL` for reliable filtered update/delete events.
- Lobby clients now listen only for player joins/leaves plus game-state updates, avoiding score-update event storms during live questions.
- Added connection-state feedback in the lobby.
- Added an automatic low-frequency database refresh as a fallback if the Realtime socket reconnects or misses an event.
- The fallback is much slower while Realtime is healthy and speeds up only while disconnected.

No user profiles, XP, Daily attempts, Practice sessions, questions, or game history are reset.
