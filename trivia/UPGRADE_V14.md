# V14 — Matchmaking + Persistent Party Rooms

Run `supabase/migrations/014_matchmaking_lobby_cycles.sql` once after deploying the V14 frontend.

## Highlights
- V2 Nova Arena is the default for new/local users; V1 remains selectable.
- Library/replay CTAs are brighter in V2.
- Quick Match matchmaking on the home hub.
- Public vs invite-only custom lobbies.
- Public lobbies can opt into matchmaking fill.
- Matchmaking creates a 10-participant match and fills empty active seats with server-side bots.
- Mid-match human joins become spectators and automatically become active on the next lobby cycle.
- Final results return the whole party to the same room/code after 8 seconds (or host/manual return).
- Bots never earn profile XP or leaderboard records.
- Active human match points still convert 1:1 to profile XP.

## V14.1 hotfix
The matchmaking migration now self-repairs missing V11/V6 prerequisite columns (`results_started_at`, `rewards_awarded_at`, `xp_awarded`, and `library_session_id`) with `ADD COLUMN IF NOT EXISTS` before installing V14 functions. It is safe to rerun after a failed V14 attempt.
