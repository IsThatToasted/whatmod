# Trivia V18 — Operations + Bulk Editorial Packs + Matchmaking Loadouts

## Database
Run `supabase/migrations/018_admin_room_controls_question_edit_matchmaking.sql` once.

## Live Ops
- Room health score/state and diagnostic reasons.
- `Refresh / Unstuck` resets a live room to its lobby while preserving humans and the room code.
- `Shutdown + Remove Players` closes the code and removes the live human/bot roster.
- Room admin actions are recorded in `room_admin_actions`.

## Question Edit Packs
Question Explorer now has **Export for Edit** and **Import Edited Pack**.
The JSON contains IDs, answer type, answers, choices, explanations, sources, media context and community vote totals. Re-import only changes records whose editable content changed, locks those records against automated content overwrite, and writes normal question audit events.

## Matchmaking
Quick Play now opens a setup screen. Players choose an exact category and Easy / Medium / Hard before pressing Play. Matchmaking only joins rooms with the same category+difficulty; otherwise it creates a new bot-filled 10-player match with that exact loadout.
