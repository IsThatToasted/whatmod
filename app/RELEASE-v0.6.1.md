# Aurelium Field v0.6.1 — iOS Authentication Rebuild

This release removes the GoogleSignIn-iOS authentication stack and rebuilds iOS login around a single WeTrack-style hosted OAuth session with a deterministic native handoff.

## iOS authentication

1. Native Swift requests the Google OAuth URL from the existing auth client.
2. `ASWebAuthenticationSession` owns the account-selection browser.
3. A tiny `native-auth-start.html` page marks that browser session as native and immediately opens the generated Google OAuth URL.
4. The hosted flow returns to the existing production web URL `https://whatmod.com/app/` — no new hosted redirect destination is required.
5. Before React renders, `index.html` detects the native marker plus returned code/tokens and immediately forwards them to `aureliumfield://auth-callback`.
6. The authentication sheet catches that callback and dismisses.
7. Native Swift exchanges the callback for the persisted Aurelium session, then renders the native SwiftUI app.

Because the handoff runs before React mounts, the website cannot become the application inside the authentication sheet.

## Removed

- GoogleSignIn-iOS package
- `GOOGLE_IOS_CLIENT_ID` build requirement
- `GOOGLE_WEB_CLIENT_ID` build requirement
- `AF-AUTH-109` native client configuration failure
- native Google token exchange path

## Build inputs

Only the existing public workspace values are required for iOS:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Error references

- `AF-AUTH-106`: sign-in browser could not start
- `AF-AUTH-107`: browser did not return the expected native handoff
- `AF-AUTH-108`: returned auth result could not become an app session

No database migration is required.
