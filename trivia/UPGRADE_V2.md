# Upgrade an existing working Trivia install to V2

1. Keep your existing `config.js` values (Supabase URL/publishable key/Twitch client ID).
2. Replace the rest of the `/trivia` frontend with the V2 files.
3. In Supabase SQL Editor, run `supabase/migrations/002_v2_existing_project_upgrade.sql` once.
4. Reload the site with a hard refresh.

The upgrade does **not** reset XP, games, wins, daily attempts, lobbies, or questions.

## Level progression
New players now begin at Level 0. Level thresholds are total XP: Level 1 = 250, Level 2 = 1,000, Level 3 = 2,250, Level 4 = 4,000, etc. Existing XP is preserved; only its displayed level is recalculated.

## Google names
On login, the app syncs Google `full_name`/`name` and avatar into the trivia profile. Once a player saves a different display name on the Profile screen, `username_customized=true` prevents future Google syncs from overwriting it.

## SQL error fixed
The old daily selector used an unqualified `digest()` call. V2 uses built-in `md5(text)`, eliminating the pgcrypto schema dependency.
