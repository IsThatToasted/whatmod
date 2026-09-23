# Add to JustGlance — Chrome Extension v1.1.0

Adds an **Add to JustGlance** button to normal web pages and can save detected products directly into shopping lists you can edit.

## Pairing

The preferred flow is now one-click pairing from JustGlance:

1. Load this unpacked extension in `chrome://extensions`.
2. The extension attempts to inject its pairing bridge into any already-open JustGlance tab automatically. If Settings does not detect it, reload `https://whatmod.com/life/` once.
3. In JustGlance open **Settings → Add to JustGlance**.
4. Confirm JustGlance shows **Extension detected · v1.1.0**.
5. Choose **Create & pair this browser**.

JustGlance securely hands the extension the raw one-time `jgext_...` token plus the public Supabase URL/publishable key already used by the web app. The extension stores no JustGlance password or Supabase user session.

Manual pairing remains available on shopping pages if needed. In that fallback path the extension attempts to read the public `/life/config.js` deployment config.

## Important after updating

Chrome does not replace an already-loaded unpacked extension automatically. Remove/reload the old extension in `chrome://extensions`, then reload existing website tabs. Version **1.0.0** contained the old “production configuration is not available yet” error path; version **1.1.0** no longer depends on that path when paired from JustGlance Settings.
