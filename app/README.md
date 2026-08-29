# Aurelium Field

A native iOS + web construction operations platform. The web app is hosted at `https://whatmod.com/app/`; native iOS source is under `app/ios`.

## Web
- React + TypeScript + Vite
- Browser Google OAuth
- Uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

## iOS
- SwiftUI, iOS 17+
- RoomPlan / ARKit / camera / speech / CoreLocation
- Native Google Sign-In only
- Google ID token + access token are exchanged with the native auth client using `signInWithIdToken`
- No hosted OAuth browser, WKWebView auth, ASWebAuthenticationSession, web bridge, or `aureliumfield://auth-callback`

### Required GitHub Actions Variables (or Secrets)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GOOGLE_IOS_CLIENT_ID`
- `GOOGLE_WEB_CLIENT_ID`

The workflow generates the runtime config resource and Google's reversed iOS URL scheme, then validates both in the built `.app` and final IPA.

### Google provider configuration
For a multi-platform web + iOS app, the Google provider should accept both client IDs, with the web client ID first and the iOS client ID second. The web client secret remains associated with the web client. Native iOS login does not use a Supabase redirect URL.

## SQL migrations
Run in order:
1. `001_initial.sql`
2. `002_walkthrough_scans.sql`
3. `003_auth_org_time_estimator.sql`
4. `004_admin_workspace_safe.sql`
5. `005_project_walkthrough_completion.sql`

No SQL migration is required for v0.6.0.

## Authentication ownership
- `AFNativeGoogleAuth`: Google SDK configuration, presentation, callback handling, token retrieval.
- `SupabaseService`: application session, membership, cloud data.
- `AureliumFieldApp`: receives the Google callback URL once at the app root.

See `ERROR_CODES.md` for public support codes.
