# Aurelium Field v0.5.0

- Admins can permanently delete a timecard with a destructive DELETE confirmation. The server RPC enforces admin authorization; dependent GPS samples and edit requests cascade away with the timecard.
- iOS Home project rows now open the Projects workspace and select the tapped job.
- iOS Projects is read-first: tapping a job opens a Project Details sheet with project metadata, walkthrough rooms, tagged evidence, estimated production labor, archive state, and the current employee's associated timecards/hours. Editing remains a separate action.
- Completed RoomPlan scans now require a clear room name before the room estimate can be saved.
- Smart Estimate now has a project-level **Walkthrough Complete** action. It archives the collected room walkthroughs locally and in Supabase, marks the project walkthrough complete, and opens a combined production estimate/proposal draft.
- Walkthrough cloud records now persist `room_name` and `archived_at`.

## Database
Run `supabase/migrations/005_project_walkthrough_completion.sql` after migration 004.
