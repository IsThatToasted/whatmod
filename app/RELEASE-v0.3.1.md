# Aurelium Field v0.3.1 — Scope Estimate + Reliable Scan Video

## Smart Estimate
- Added expandable post-scan scope toggles for Paint Doors, Paint Windows, Paint Trim, and Paint Ceiling.
- Each enabled scope exposes detected/estimated quantity and an editable production rate.
- Walls remain included by default.
- Ceiling square footage derives from RoomPlan floor surfaces (room footprint).
- Trim starts from wall perimeter plus detected door/window casing lengths and remains editable.
- Auto estimate now stores per-scope labor and combined room labor.
- Supabase sync creates one estimate line item per enabled painting scope.

## Walkthrough video reliability
- Removed ReplayKit screen recording from Smart Walkthrough.
- Added direct AR camera-frame MP4 recording via AVAssetWriter at approximately 10 fps / 720x1280.
- Video failure is non-blocking: RoomPlan geometry, narration, tags, USDZ and estimate can still complete.
- The scan UI shows video status without interrupting the walkthrough with a recording error alert.
- Scan Review only shows video when a finalized MP4 actually exists.
