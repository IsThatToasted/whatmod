# Aurelium Field native authentication (v0.5.6)

Aurelium Field now uses the same ownership model proven by WeTrack:

1. iOS opens `https://whatmod.com/app/?af_native_auth=1` in `ASWebAuthenticationSession`.
2. The Aurelium web client starts Google OAuth and uses the ordinary production web return URL: `https://whatmod.com/app/`.
3. After the web client has a valid session, it hands the access + refresh token pair to iOS through `aureliumfield://auth-callback`.
4. `ASWebAuthenticationSession` closes automatically because that private callback scheme belongs to the native session.
5. Native Swift installs the session with `auth.setSession(...)` and continues organization onboarding.

The hosted auth service never receives `aureliumfield://...` as `redirectTo` in this flow. Existing web auth redirect configuration is reused.

Public error codes:
- `AF-AUTH-103` native/web auth bridge could not start or finish.
- `AF-AUTH-104` hosted sign-in returned an error.
- `AF-AUTH-105` web sign-in completed without a transferable session.
