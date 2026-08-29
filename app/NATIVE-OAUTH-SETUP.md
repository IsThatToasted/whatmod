# Aurelium Field Native OAuth Setup

## Auth dashboard

Open Authentication -> URL Configuration.

Set Site URL:

- `https://whatmod.com/app/`

Add Redirect URLs:

- `https://whatmod.com/app/**`
- `aureliumfield://auth-callback`
- `aureliumfield://**`

The native application requests `aureliumfield://auth-callback`. The wildcard entry is included to tolerate path/trailing-slash normalization.

## Google Cloud OAuth client

Keep the Google OAuth client as a **Web application** OAuth client for the hosted auth flow.

The Google Authorized redirect URI should remain the callback URI shown on the Google provider page of the auth dashboard, normally:

- `https://<project-ref>.supabase.co/auth/v1/callback`

Do not replace the Google Authorized redirect URI with `aureliumfield://...`. Google returns to the hosted auth callback first; the auth service then redirects into Aurelium Field.

## Expected iOS flow

1. User taps Continue with Google.
2. iOS opens an `ASWebAuthenticationSession`.
3. User selects a Google account.
4. Google returns to the hosted auth callback.
5. Auth redirects to `aureliumfield://auth-callback`.
6. `ASWebAuthenticationSession` captures that scheme and closes automatically.
7. Aurelium Field imports the returned session and loads organization access.

## Support codes

- `AF-AUTH-101` — native system sign-in session failed to start or complete.
- `AF-AUTH-102` — expected native callback/redirect was not returned correctly.
- `AF-AUTH-002` — callback reached the app but could not be imported into a session.
