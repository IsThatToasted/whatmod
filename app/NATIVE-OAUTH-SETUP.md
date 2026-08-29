# Aurelium Field Native OAuth Setup — v0.5.7

This now mirrors the working WeTrack iOS flow.

## Auth redirect allowlist

Keep the normal web redirect for the web app and add only this exact native callback for iOS:

`aureliumfield://auth-callback`

No `aureliumfield://**` wildcard and no special web bridge URL are used by the native flow.

## Google Cloud OAuth client

Keep the Google OAuth client configured with the hosted auth callback supplied by the Google provider configuration. Do not add `aureliumfield://...` to Google Cloud.

## Native lifecycle

1. Aurelium asks the native auth client for the Google OAuth URL with `redirectTo: aureliumfield://auth-callback`.
2. `ASWebAuthenticationSession` opens the returned hosted OAuth URL and listens for callback scheme `aureliumfield`.
3. Google signs the user in and returns to the hosted auth callback.
4. The hosted auth flow redirects once to `aureliumfield://auth-callback`.
5. iOS closes the authentication sheet automatically and hands the callback to Aurelium.
6. Aurelium calls `auth.session(from:)` and continues into organization/project loading.
