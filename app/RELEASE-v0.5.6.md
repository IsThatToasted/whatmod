# Aurelium Field v0.5.6 — WeTrack-style native auth bridge

## Why this release exists
The previous native OAuth flow depended on the hosted auth service redirecting directly to `aureliumfield://auth-callback`. The user's working WeTrack project uses a more reliable ownership model: the web client owns hosted OAuth/session establishment and the native shell owns the browser sheet/callback handoff.

## New flow
1. Native iOS opens `https://whatmod.com/app/?af_native_auth=1` in `ASWebAuthenticationSession`.
2. The production Aurelium web client starts Google OAuth.
3. Hosted OAuth returns to the already-working web URL `https://whatmod.com/app/`.
4. The web client waits for its authenticated session and redirects the auth sheet to `aureliumfield://auth-callback` with the access/refresh token pair.
5. `ASWebAuthenticationSession` closes automatically.
6. Native installs the session with `auth.setSession(accessToken:refreshToken:)` and continues into organization onboarding/the app.

## Backend redirect configuration
No new native/mobile redirect URL is required by this v0.5.6 flow. It reuses the existing production web redirect configuration that already powers the working web app.

## Validation
- Swift syntax parse passed across all iOS Swift source.
- YAML parse passed for XcodeGen and GitHub Actions workflows.
- TS/TSX syntax transpile check passed.
- Full npm dependency install/build could not be completed in the local environment because dependency installation timed out; GitHub Pages Actions remains the authoritative web build.
