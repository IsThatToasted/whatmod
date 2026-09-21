# Trivia V11 – Multiplayer Auto Flow

V11 changes multiplayer rounds to an authoritative timed state machine:

- Question timer expiry immediately reveals results for every participant.
- Unanswered players receive 0 points for the round.
- Results stay visible for 5 seconds, then the game automatically advances.
- The last results screen automatically finalizes the match after 5 seconds.
- Host Reveal / Next / Finish controls remain available as manual overrides.
- Timers are based on Supabase timestamps so rerenders/reconnects do not restart a round.
- Host override RPCs include an expected round index so stale buttons cannot affect a newer round.
- Multiplayer score is now awarded 1:1 as profile XP when the match finishes.
- Match reward application is idempotent through `games.rewards_awarded_at`.

Run `supabase/migrations/012_multiplayer_autoflow.sql` once on an existing project.
