# Aurelium Field v0.5.5 — Native OAuth callback fix

- Replaced the native Google OAuth convenience flow with an explicit `ASWebAuthenticationSession`.
- The system sign-in sheet now listens for the `aureliumfield` callback scheme and closes when the callback arrives.
- Keeps `.onOpenURL` handling as a cold-launch/deep-link fallback.
- Adds `AF-AUTH-101` / `AF-AUTH-102` support codes without exposing provider internals.
- Requires the Auth redirect allowlist to include `aureliumfield://auth-callback` and preferably `aureliumfield://**`.
- No database migration required.
