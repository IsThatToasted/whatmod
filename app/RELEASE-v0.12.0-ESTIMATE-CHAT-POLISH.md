# Aurelium Field v0.12.0 — Build 30

## Focus
This release deepens the two differentiating estimating experiences and polishes team communication without changing the stable authentication/workspace architecture.

## Blueprint Estimate
- New four-part review workspace: Overview, Takeoff, Sheets, Issues.
- Readiness card with paintable area, labor, verification percentage, blockers and warnings.
- Editable takeoff assumptions: coats, waste, fallback wall height, production rates and included scopes.
- Preserves extracted room dimensions so a reviewed fallback wall height can derive gross wall area when plans omit height.
- Every extracted quantity can be opened, corrected and explicitly verified.
- Proposal readiness now requires zero unresolved blocking issues and zero included takeoff lines still marked for verification.
- Issue resolution/reopen controls.
- Reviewed Blueprint updates now upsert to Supabase instead of silently failing on duplicate IDs.
- Blueprint estimate cloud records persist assumptions/review timestamp through migration 012.

## Walkthrough Editing
- Re-review nearly all estimate assumptions without rescanning.
- Paint Walls / Doors / Windows / Trim / Ceiling can be toggled on or off.
- Editable quantities and production rates for every scope.
- Editable room/elevation name and notes.
- Shows scanner-detected vs estimator-confirmed door/window counts.
- Editable measurement-confirmed state.
- Editable paintable wall area, ceiling area, trim linear feet and average wall height.
- Reset scope quantities from saved geometry.
- Full labor recalculation on save.
- Active project estimate is rebuilt after edit.
- New door/window corrections made during editing are persisted as Teach Scanner learning samples.
- Raw RoomPlan/AR geometry, evidence, video, JSON and USDZ remain preserved.

## Chat
- Modern channel/group/direct-message organization on web and iOS.
- New chat composer for Channel, Group and Direct conversation types.
- Channel audience controls: Everyone, Selected Members, Admins Only.
- Admin-only access is enforced by database RLS, not merely hidden in UI.
- Selected-member groups/direct chats are membership scoped.
- Admins can invite specific organization members when creating chats.
- Atomic chat_create_conversation RPC creates conversation + membership together.
- Reply UI and quoted context on web/iOS.
- More modern conversation list, message bubbles, search and headers.
- Existing chat_create_channel RPC remains as a compatibility wrapper for older clients.

## Database
Apply only:
- `012_chat_audience_admin_groups.sql`

Migration 012:
- adds `chat_conversations.audience`
- repairs/extends centralized chat access logic
- adds `chat_create_conversation(...)`
- adds `chat_set_members(...)`
- preserves the legacy `chat_create_channel(...)` entry point
- adds Blueprint `assumptions` and `reviewed_at` columns

Do not rerun migrations 001–011.

## Version
- iOS: 0.12.0 (Build 30)
- Web: v0.12.0-estimate-chat-polish
