# Afterglow v4.1 — Match Persistence Sweep

## Problem fixed

The v3/v4 directory privacy rule treated every profile beyond the free discovery radius as a locked discovery result. That also stripped the `liked` signal used by the browser to infer a mutual match. Because Matches and Chat were built from the same `people` directory array, an established long-distance match could disappear from Matches/Chat even though both durable profile rows and the message history still existed.

## Production behavior in v4.1

- Mutual matches bypass discovery-distance locking.
- Incoming likes bypass discovery-distance locking so they can always be reviewed.
- Exact coordinates are still never returned to another user.
- Non-connected free users beyond the free discovery boundary remain non-identifying locked shells.
- The server returns explicit relationship flags (`iLike`, `likesMe`, `mutual`) so a fresh browser session does not have to infer the relationship solely from local cache.
- Mutual matches are returned even if they fall outside the normal directory result limit.
- Explorer keeps established matches visible regardless of the current distance/chemistry filters and marks them `MATCHED`.
- A matched Explorer profile shows `Matched + Message`, not `Pass`, so browsing cannot accidentally tear down a relationship.
- Matches/Chat remain available regardless of whether the other person is currently online. Presence is not used as a match condition.

## Deployment

For an existing v4 database, run only:

`supabase-match-persistence-v4.1.sql`

Then deploy the contents of this `fantasy` folder. `index.html` contains a v4.1 cache-busting asset version so browsers do not continue running the older JavaScript.

For a fresh database, use `supabase-schema-v4.1.sql`.

## Acceptance test

1. Account A and Account B must already mutually like one another.
2. Give the accounts locations more than 50 miles apart (600+ miles is fine).
3. Sign Account B out completely.
4. Fresh-login Account A in a private/incognito window.
5. Confirm Account B is present under Matches.
6. Confirm Account B is present in Chat and the conversation can be opened.
7. Confirm Account B is visible in Explorer with a MATCHED badge and its real approximate distance.
8. Send a message while Account B is signed out.
9. Sign Account A out and sign Account B in.
10. Confirm the match/chat is still present and the unexpired message loads.
