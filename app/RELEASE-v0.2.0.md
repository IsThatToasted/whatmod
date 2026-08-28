# Aurelium Field v0.2.0

## Smart Walkthrough
- RoomPlan + narration are one full-screen workflow.
- Narration starts with the scan when permission is available and can be toggled in-place.
- Five high-contrast capture controls persist actual AR camera frames with evidence tags.
- Scan screen clearly names the active project.
- Scan completion stores room counts, transcript, evidence metadata and a reviewable scan video.
- Walkthrough review presents video, transcript, RoomPlan counts, and tagged-image gallery.
- Walkthrough deletion removes associated local video/photos.

## Projects
- Add project.
- Edit project.
- Delete project.
- Search by job, client, or location.
- Smart Estimate project search selects the job before scanning.

## Backend readiness
Apply `supabase/migrations/002_walkthrough_scans.sql` after migration 001. It adds first-class walkthrough sessions and evidence tags to project media while preserving organization RLS.
