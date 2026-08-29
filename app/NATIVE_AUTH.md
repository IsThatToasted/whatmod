# Aurelium Field native authentication (v0.5.7)

Aurelium Field now follows the same OAuth ownership pattern used by the working WeTrack iOS project.

## Native flow

1. The native auth client generates the hosted Google OAuth URL with `getOAuthSignInURL` and `redirectTo: aureliumfield://auth-callback`.
2. Aurelium Field opens that URL in `ASWebAuthenticationSession` with callback scheme `aureliumfield`.
3. Google returns to the hosted auth callback.
4. The hosted auth service redirects once to `aureliumfield://auth-callback`.
5. `ASWebAuthenticationSession` closes automatically and returns that callback URL to Aurelium Field.
6. The app passes the callback to `auth.session(from:)`, which installs/persists the authenticated session.

There is no web bridge page and no `?af_native_auth=1` flow.

## Redirect configuration

This mirrors WeTrack: the auth project's redirect allowlist needs the exact native callback:

`aureliumfield://auth-callback`

The Google Cloud OAuth redirect remains the hosted auth callback supplied by the Google provider setup. Do not add the custom iOS scheme to Google Cloud.

The web application continues to use `https://whatmod.com/app/` for normal browser sign-in.
