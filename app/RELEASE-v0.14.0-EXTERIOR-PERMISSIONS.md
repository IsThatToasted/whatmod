# Aurelium Field v0.14.0 — Build 33
## Exterior Scanner Release Pass + Admin Reliability + Per-user Permissions

### Exterior Smart Scanner
- Rebuilt exterior capture around persistent ARKit facade tracking rather than exposing every frame-level primitive.
- Vertical wall planes require repeated stable observations before being promoted to a locked facade measurement.
- Tracks geometry stability and capture confidence.
- Opening candidates persist across multiple camera frames using overlap-based tracking before being shown.
- Suppresses transient rectangles and limits the live candidate set.
- Opening confirmation prefers raycasts against existing mapped vertical plane geometry before falling back to estimated planes.
- Rejects implausible opening dimensions rather than contaminating the takeoff.
- Teach Scanner remains available for windows, doors, openings and roof slope corrections.
- Review continues to calculate gross facade area, opening deductions, net paintable area and labor scopes.
- Added `EXTERIOR-MODEL-TRAINING.md` describing the production Core ML training/deployment path. The first learned classes should be window, exterior door, garage door and wall opening. Physical dimensions remain AR/raycast-derived rather than model-box-derived.

### Admin Workspace AF-NET-103
- Admin iOS loading is no longer all-or-nothing.
- Employees, timecards, edit requests, invites and estimate packets load independently.
- Failure in one admin module no longer prevents the rest of Admin Workspace from rendering.
- Generic network collapse is replaced at the workspace level with `AF-ADM-103` and the affected module names.
- Frozen `WorkspaceService.swift`, `AuthView.swift` and `AureliumFieldApp.swift` remain byte-identical to v0.13.0.

### Per-user permissions
Migration 014 introduces organization-member capability overrides. Initial capabilities:
- Send Chat
- Create Chat
- Edit Time Sheet
- Submit Time Sheet
- Add Photos
- Daily Logs
- Punch / Quality
- Smart Scanner
- Blueprint Estimate

Owners/admins always retain all permissions. Other active members default to allowed until an admin explicitly disables a capability.

Native iOS Admin > Employees > Edit Employee now exposes grouped permission toggles. Responsive web/mobile Admin employee editing exposes the same controls.

Enforcement in this release:
- `chat.send` — enforced by PostgreSQL RLS on message inserts.
- `chat.create` — enforced inside `chat_create_conversation` and in both clients.
- `time.edit_own` — respected by native timecard editing UI.
- `time.submit` — respected by native timecard submission UI.
- Remaining capability keys are persisted and intended to gate those modules in subsequent surface-level hardening without another schema redesign.

### Database
Run only `014_member_permissions_exterior_release.sql` after migration 013. Do not rerun earlier migrations.

### Version
- iOS: 0.14.0
- Build: 33
- Web marker: v0.14.0-exterior-permissions
