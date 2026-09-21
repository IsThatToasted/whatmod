# Upgrade to Trivia V3

1. Deploy the V3 `/trivia` files.
2. Keep your existing `trivia/config.js`.
3. In Supabase SQL Editor run:
   `trivia/supabase/migrations/003_daily_lock_and_practice.sql`
4. Hard-refresh the site once.

## Important
The Daily restriction is enforced in PostgreSQL, not just the UI. A refresh, second tab,
or direct RPC call cannot award Daily XP twice for the same user/day.

Practice mode is unlimited and intentionally awards zero XP.
