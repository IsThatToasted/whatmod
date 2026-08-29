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

Add these Auth redirect URLs in **Authentication → URL Configuration → Redirect URLs**:

- `https://whatmod.com/app/**`
- `aureliumfield://auth-callback`

Keep the production Site URL set to `https://whatmod.com/app/`. The wildcard native entry makes the custom iOS callback resilient to path/trailing-slash normalization.

Web authentication uses Google OAuth through the shared Auth project. Native iOS follows the same OAuth lifecycle used by WeTrack: it generates the hosted OAuth URL without launching a browser automatically, opens that URL in `ASWebAuthenticationSession`, then imports the returned callback with the native auth client. The Google Cloud OAuth client's authorized redirect URI remains the hosted Auth callback endpoint; do not replace it with the custom iOS scheme.

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

The root workflow builds a physical-device `iphoneos` target and packages `AureliumField.ipa`. It validates the two repository variables, generates the private build-time `RuntimeConfig.json` bundle resource, verifies that resource in the built `.app`, and re-verifies it inside the final IPA before publishing the artifact. The IPA remains unsigned until Apple signing credentials are configured.


## v0.3.1 walkthrough update
Smart Walkthrough now records AR camera frames directly instead of using ReplayKit, and the post-scan estimate supports optional doors, windows, trim, and ceiling production scopes.

## v0.4.0 Admin Workspace
Apply `supabase/migrations/004_admin_workspace.sql` after migrations 001–003. The migration is required for Admin View employee management, audited timecard adjustments, invite revocation, and the tighter employee timecard/membership RLS rules.


## v0.5.0 database update
Run `supabase/migrations/005_project_walkthrough_completion.sql` after the safe 004 migration. It is idempotent.



## v0.5.2 iOS compiled configuration

The iOS GitHub workflow no longer depends on custom Info.plist build-setting expansion for runtime cloud configuration. It generates `AureliumField/Services/RuntimeConfig.swift` from the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` repository Variable/Secret values before Xcode compiles the target, verifies those generated constants match the build inputs, and confirms the file is included in the Swift compile file list before packaging the IPA. Build/configuration failures use `AF-CFG-001`.

## v0.5.1 configuration + public error codes
The iOS workflow now hard-validates packaged runtime configuration before IPA creation. User-facing production errors are sanitized into stable `AF-*` reference codes; see `ERROR_CODES.md`. Raw provider/database/storage errors are not rendered to end users.

### v0.5.3 iOS runtime configuration
The iOS workflow generates `AureliumField/Resources/RuntimeConfig.json` from the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` repository Actions Variables/Secrets used by the web build. The workflow verifies the copy inside the final `.app` before creating the IPA. The checked-in JSON is intentionally blank and is not suitable for a production manual build until populated by CI.

## v0.5.4 iOS runtime configuration

The native runtime configuration loader no longer assumes `RuntimeConfig.json` is flattened into the iOS bundle root. It resolves the resource from known bundle locations and includes a bounded recursive fallback, matching the resource location verified by CI. The root iOS workflow also re-verifies the resource inside the final IPA. Configuration faults use `AF-CFG-101` through `AF-CFG-105` for precise support lookup without exposing infrastructure details to users.

## v0.5.7 native OAuth reconstruction

The native Google sign-in flow mirrors the working WeTrack pattern. Aurelium generates the hosted OAuth URL, opens it in `ASWebAuthenticationSession`, receives `aureliumfield://auth-callback`, and converts that callback directly into the persisted native session. There is no web bridge page. The auth redirect allowlist only needs the exact native callback in addition to the normal web URL.


## Google Auth

Web uses hosted OAuth. iOS v0.5.8 uses native Google Sign-In with `GOOGLE_IOS_CLIENT_ID` and `GOOGLE_WEB_CLIENT_ID`.
