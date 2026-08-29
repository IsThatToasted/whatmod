# Aurelium Field

Aurelium Field is a construction operations application with a React/Vite web client and a native SwiftUI iOS client.

## Web authentication

The web app keeps its existing browser Google OAuth flow and returns to `https://whatmod.com/app/`.

## iOS authentication

The iOS application uses a WeTrack-style system browser handoff while the application itself remains native SwiftUI:

1. Swift requests the hosted Google OAuth authorization URL from the existing workspace auth client.
2. `ASWebAuthenticationSession` opens `https://whatmod.com/app/native-auth-start.html`, which marks that browser session as native and immediately opens the generated authorization URL.
3. The hosted authentication flow returns to the same production web URL already used by the web app: `https://whatmod.com/app/`.
4. Before React mounts, `index.html` sees the native marker plus the returned auth code/tokens and forwards them to `aureliumfield://auth-callback`.
5. `ASWebAuthenticationSession` catches that callback and dismisses.
6. Native Swift exchanges the callback for the persisted app session, then renders the full-screen SwiftUI application.

There is no GoogleSignIn-iOS dependency and no iOS-specific Google client ID build requirement.

## iOS build inputs

The iOS workflow uses the same existing public workspace build values as the web app:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The workflow writes those values to the bundled runtime configuration and verifies the actual built app and final IPA before publishing the artifact.

## Auth ownership

- `AFNativeOAuthCoordinator`: owns only the system authentication sheet and callback handoff.
- `SupabaseService`: owns the app session and organization membership state.
- `AuthGateView`: switches between signed-out, onboarding, and the native application root.
- `AureliumFieldApp`: provides a cold-launch/open-URL fallback for the Aurelium callback scheme.

## Database migrations

Run migrations in order:

1. `001_initial.sql`
2. `002_walkthrough_scans.sql`
3. `003_auth_org_time_estimator.sql`
4. `004_admin_workspace_safe.sql`
5. `005_project_walkthrough_completion.sql`

No database migration is required for v0.6.1.
