# JustGlance v2.4.2 — Retailer-aware browser capture

## Chrome extension v1.2.0

- Replaced the single generic scraper with a layered product parser.
- Added an Amazon DOM adapter for `#productTitle`, Amazon breadcrumbs, split `priceToPay` prices, ASIN and `#landingImage` / `data-old-hires`.
- Added retailer adapters for Walmart, Target, Etsy and Best Buy, with JSON-LD/OpenGraph fallback on other stores.
- Product capture now exposes and saves category explicitly.
- The panel shows whether title, image, price and category were detected and which parser produced the result.
- Added **Rescan product page** for variant/page changes.
- Browser metadata records the parser and detected-field diagnostics for troubleshooting.

No database migration is required for v2.4.2. The shared `web-pages.yml` deployment remains unchanged.
