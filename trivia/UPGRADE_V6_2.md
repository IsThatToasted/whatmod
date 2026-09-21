# Trivia V6.2 — Safari broken-image cleanup

- Failed question/library images are now physically removed from the DOM after fallback attempts are exhausted.
- Prevents Safari/iOS from rendering its native broken-image icon above the app fallback card.
- Guards against duplicate fallback execution.
- Adds CSS hardening for failed/hidden media.
- Bumps the service worker cache to `whatmod-trivia-v6.2`.
- No database migration is required.
