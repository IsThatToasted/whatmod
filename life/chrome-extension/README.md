# Add to JustGlance — Chrome extension

Manifest V3 unpacked extension for JustGlance v2.2.0.

## What it does

- Adds a persistent **Add to JustGlance** button at the bottom-left of normal HTTP/HTTPS pages.
- Reads product JSON-LD, OpenGraph/meta tags and common product attributes directly from the current page.
- Captures title, canonical URL, image, price, currency, store, brand, category and product ID when available.
- Syncs the user's currently accessible named JustGlance shopping lists through a revocable shopping-only token.
- Suggests a list using the product metadata and list name. For example, a stiletto/platform product can suggest **Heels**, while lingerie/panty/thong/bra products can suggest **Lingerie/Panties**.
- Lets the user edit title/price, choose another list, and add optional size/color/notes before saving.

## Install locally

1. Run `004_smart_shopping_browser_bridge.sql` in the JustGlance Supabase project.
2. In Chrome open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select this `chrome-extension` folder.
6. In JustGlance open **Settings → Add to JustGlance** and create a pairing code.
7. Open any shopping page, click the bottom-left **Add to JustGlance** button, and paste the pairing code once.

The extension fetches the public JustGlance `config.js` to discover the existing Supabase URL/anon key; it does not require a second copy of those GitHub secrets.

## Security

The extension never stores the user's Supabase password or Supabase session token. It stores only a random JustGlance browser integration token. The database stores only a SHA-256 hash of that token. The token can call only the two shopping bridge RPCs and every write re-checks the user's current `edit_shopping` permission for the selected Space. Revoke a browser at any time from JustGlance Settings.
