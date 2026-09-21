# Trivia V10 — Question Governance + Community Voting

V10 adds a production question-governance layer without resetting any existing
profiles, games, hydrated questions, media, XP, or replay data.

## New player-facing behavior

- Question images are secondary 168px framed thumbnails at the upper-right of
  the prompt instead of large center-stage media.
- Signed-in players can thumbs-up / thumbs-down every Daily, Practice, Party,
  and replay question.
- Votes are one-per-user-per-question and can be toggled or switched.
- Admins get a discreet **Delete question** control during Party and Practice.

## Live admin deletion

`admin_delete_question_v10` immediately removes the question from the active
question bank. Any active Party match containing it is reindexed; if it is the
current round, all connected players receive the next question through the
existing realtime game-state subscription. If the deleting admin is currently
in Practice, that Practice session is advanced as well.

For production safety the database row is retained as an inactive audit
tombstone rather than physically destroyed. This preserves historical attempt
foreign keys and the complete audit record while making the question impossible
to select for new games. Public replay packs containing it are hidden.

## `/triviaadmin/`

The admin dashboard now has three areas:

- **Questions** — full question explorer, community vote totals, add/edit/delete/
  restore, answer editing, explanations, sources, and media search subjects.
- **Media** — the existing local resolver/media moderation workflow.
- **Changes** — append-only audit history showing action, administrator,
  timestamp, changed fields, and before/after snapshots.

## Upgrade

Run `supabase/migrations/011_question_governance.sql` once, then deploy the V10
frontend/admin files. No other migration needs to be rerun.
