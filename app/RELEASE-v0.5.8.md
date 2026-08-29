# Aurelium Field v0.5.8 — Native iOS Google Sign-In

## Why this release exists
Aurelium Field is a native SwiftUI application. The previous hosted OAuth approach used `ASWebAuthenticationSession`; if the hosted auth service fell back to the web Site URL, the website could remain visible inside the authentication sheet, making the product look like a web app inside a modal.

WeTrack behaves differently because its iOS application is itself a full-screen `WKWebView` wrapper. That architecture is appropriate for WeTrack but not for Aurelium Field's RoomPlan, LiDAR, GPS, camera, speech and native workflow requirements.

## New native sign-in architecture
The iOS application now uses Google's native iOS SDK:

1. iOS presents native Google account selection.
2. Google returns an ID token and access token to Aurelium Field.
3. Aurelium Field sends those credentials to the existing authentication backend with `signInWithIdToken`.
4. The backend returns the normal Aurelium session.
5. SwiftUI transitions directly to the native app root.

There is no hosted Aurelium website inside the iOS login flow and no iOS authentication redirect URL is required in the backend URL allowlist.

## GitHub Actions variables
The iOS build now requires these public repository variables (or Secrets):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GOOGLE_IOS_CLIENT_ID`
- `GOOGLE_WEB_CLIENT_ID`

The workflow automatically derives and injects the reversed Google callback scheme into the built Info.plist and verifies it again inside the final IPA.

## Google configuration
Create an iOS OAuth Client ID for bundle identifier:

`com.aurelium.field`

`GOOGLE_WEB_CLIENT_ID` should be the existing Web OAuth Client ID already used for the Google provider.

The iOS and web client IDs are not secrets.

## Error codes
- `AF-AUTH-109` — native Google client configuration missing/invalid
- `AF-AUTH-110` — native Google sign-in could not be presented
- `AF-AUTH-111` — Google sign-in returned no usable ID token
- `AF-AUTH-112` — native Google credentials could not be exchanged for an Aurelium session

## Database
No SQL migration is required.
