# Aurelium Field v0.5.7 — WeTrack auth reconstruction

- Removed the v0.5.6 web/native auth bridge and blank bridge page.
- Rebuilt iOS Google OAuth to match WeTrack's proven lifecycle:
  - generate OAuth URL without automatic browser redirect,
  - open it in `ASWebAuthenticationSession`,
  - receive the custom callback,
  - convert the callback into a native auth session.
- Web login is again independent and unchanged.
- Preserved runtime configuration resource validation and all v0.5.x project/admin/walkthrough features.
- Added AF-AUTH-106/107/108 for native OAuth launch, callback, and session-completion failures.
