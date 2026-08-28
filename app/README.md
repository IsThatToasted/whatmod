# Aurelium Field v0.3.1

Unified construction operations platform with painting-first Smart Estimate workflows.

## Repository layout

Place the `app` folder at `whatmod/app`. GitHub Actions must remain at the repository root under `.github/workflows/` (the release ZIP includes them there too).

## Required GitHub repository variables

Under **Settings → Secrets and variables → Actions → Variables**:

- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase publishable/anon key

The web Vite build and iOS Xcode build both use these same public client values. Never use the service-role key here.

## Supabase migrations

Apply in order in the SQL editor:

1. `supabase/migrations/001_initial.sql`
2. `supabase/migrations/002_walkthrough_scans.sql`
3. `supabase/migrations/003_auth_org_time_estimator.sql`

Migration 003 adds secure organization bootstrap/invites, GPS timecards, submission/edit approvals, private walkthrough storage, RoomPlan USDZ paths, and estimator measurement fields.

## Google authentication

Google must be enabled in Supabase Auth.

Add these Supabase Auth redirect URLs:

- `https://whatmod.com/app/`
- `aureliumfield://auth-callback`

Web authentication uses Supabase Google OAuth. Native iOS uses the same Supabase Auth project and the custom callback scheme above.

## Organization onboarding

After first Google login, a user must **Create** or **Join** an organization. `create_organization()` transactionally creates the organization and makes the creator `owner`. Owners/admins can generate expiring join links with a specific employee role.

## Time clock

- Clock-in requires a project and requests GPS location.
- iOS continues sampling location while the active shift is running in-app.
- Web captures accurate clock-in and clock-out GPS positions when browser permission is available.
- Timecards remain `draft` after clock-out and can be edited freely.
- **Confirm & Submit** moves a timecard to `submitted`.
- Corrections after submission use `time_entry_edit_requests` and require an owner/admin decision.

## Smart Walkthrough / estimate

The native iOS Smart Walkthrough now:

1. Runs RoomPlan + live speech narration + tagged evidence captures.
2. Records a visual walkthrough review.
3. Exports the completed RoomPlan result as USDZ and serializes its RoomPlan JSON.
4. Calculates every detected wall's length, height, and gross area.
5. Calculates total wall linear feet, average wall height, gross wall area, detected door/window area, and net paintable wall area.
6. Requires the estimator to confirm the scan is reasonably accurate.
7. Requests a painting production rate in square feet per labor hour.
8. Generates estimated labor hours for the room.
9. Saves locally immediately, then syncs the walkthrough model/video/JSON/evidence to private Supabase Storage and creates estimate/room/surface/line-item records.

The review screen can reopen the saved USDZ room model through Quick Look.

## iOS build

The root workflow builds a physical-device `iphoneos` target and packages `AureliumField.ipa`. It injects the two repository variables above as iOS build settings. The IPA remains unsigned until Apple signing credentials are configured.


## v0.3.1 walkthrough update
Smart Walkthrough now records AR camera frames directly instead of using ReplayKit, and the post-scan estimate supports optional doors, windows, trim, and ceiling production scopes.
