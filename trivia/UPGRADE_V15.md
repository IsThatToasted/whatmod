# Trivia V15 — Admin Insights + Live Operations

V15 expands `/triviaadmin` with three production moderation/operations systems while preserving all V14 matchmaking behavior.

## New admin capabilities

- Click the total 👍 / 👎 cards in Question Explorer to open a dedicated community-vote review page.
- Edit or permanently retire questions directly from vote review.
- Bulk-disable every active question without a valid stored photo.
- Undo the photo gate without restoring questions that were permanently deleted.
- Audit entries distinguish bulk photo disables/restores from normal question deletion/restoration.
- New Live Ops tab shows signed-in users with a recent heartbeat, active games, room codes/statuses, humans, spectators, bots, scores, and current questions.

## Player presence

The Trivia client sends a lightweight authenticated heartbeat every 25 seconds. Admin considers a user online for 90 seconds after the most recent heartbeat. Presence is observability-only; gameplay does not depend on it.

## Database

Run `015_admin_insights_live_ops.sql` after the V14.2 schema reconciler/migrations. It is additive and does not reset XP, questions, media, votes, matches, or profiles.
