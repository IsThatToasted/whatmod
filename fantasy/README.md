# Fantasy Vault — Clean OAuth Build

Upload the contents of this zip directly into `/fantasy/` so `index.html` is at:

`https://whatmod.com/fantasy/index.html`

## Supabase Auth settings

Supabase → Authentication → URL Configuration:

Site URL:

`https://whatmod.com/fantasy/`

Redirect URLs:

`https://whatmod.com/fantasy/`
`https://whatmod.com/fantasy`

## Google Cloud OAuth client

Authorized JavaScript origin:

`https://whatmod.com`

Authorized redirect URI:

`https://gqkkdocvfstbsekxyrbo.supabase.co/auth/v1/callback`

Do not add `whatmod.com/fantasy` as a Google redirect URI for Supabase OAuth. Google redirects to Supabase; Supabase redirects back to the app.

## What changed

- OAuth redirect is centralized in `config.js`.
- The app normalizes redirects to `https://whatmod.com/fantasy/`.
- A safety rescue moves any old `localhost:3000/#access_token=...` callback back to the live app.
- The app uses Supabase `detectSessionInUrl: true` to process the token hash after redirect.


## Safe auth flow patch

This build prevents a signed-in Supabase user from being trapped behind the 18+ landing screen. If Google/Supabase reports an active session, the app automatically marks the local gate as passed, shows Enter Fantasy Vault, shows Sign out, and can auto-enter. The landing screen also has Reset local app data for clearing broken localStorage without deleting the Supabase account.
