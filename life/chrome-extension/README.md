# Add to JustGlance — Chrome Extension v1.2.0

Adds an **Add to JustGlance** button to normal web pages and saves products directly to shopping lists you can edit.

## v1.2.0 product extraction

The extension now uses a layered product parser instead of relying on one generic metadata strategy:

1. Retailer-specific DOM adapters
2. JSON-LD `Product` structured data
3. OpenGraph / product meta tags
4. Generic product/breadcrumb fallbacks

Built-in retailer adapters currently include:

- Amazon
- Walmart
- Target
- Etsy
- Best Buy

Amazon extraction specifically supports the current product-title, breadcrumb/category, price-to-pay, ASIN, and landing-image structures. The parser also understands split Amazon prices (`a-price-whole` + `a-price-fraction`) when `.a-offscreen` is empty.

The capture panel displays a small extraction status for **Title / Image / Price / Category**, shows which parser was used, and includes **Rescan product page** for stores that change the active variant after initial page load.

## Install / update

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Remove older copies of **Add to JustGlance**, or replace the files in the existing unpacked extension folder.
4. Choose **Load unpacked** and select this folder.
5. Verify the extension version is **1.2.0**.
6. Open JustGlance → Settings → Add to JustGlance and pair the browser if needed.

## Notes

- Product parsing happens locally in the current product page. No retailer login credentials are sent to JustGlance.
- Retailers change markup regularly. The generic structured-data fallback remains active when a site-specific selector changes.
- `product-parser.js` is intentionally separated from the panel UI so retailer adapters can be expanded without rewriting pairing or saving logic.
