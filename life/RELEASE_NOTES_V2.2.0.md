# JustGlance v2.2.0 — Smart Shopping + Add to JustGlance

## Smart shopping links

- Every named Space shopping list now has a dedicated smart-add field.
- Paste a normal item name or a product URL.
- Product links can fill title, canonical URL, image, price, currency, store, brand, category and product ID when metadata is available.
- A preview is shown before saving and the destination list remains editable.
- List suggestions use both direct name matching and useful category hints. Lists such as **Lingerie/Panties** and **Heels** can therefore be selected automatically from matching product metadata.
- Saved products keep a thumbnail, price and direct product link on the item card.

## Chrome extension

`/life/chrome-extension` is a Manifest V3 unpacked extension with a persistent bottom-left **Add to JustGlance** button on normal web pages.

The extension:

- parses JSON-LD Product data, OpenGraph tags and common product metadata from the current page;
- previews title, image, price, currency, store, brand and category;
- downloads the user's current editable JustGlance shopping lists;
- suggests the best list;
- lets the user edit title/price and add size/color/notes;
- saves directly to Supabase through a narrowly-scoped browser integration RPC;
- never stores the user's Supabase password or Supabase auth session.

Browser integrations are revocable in JustGlance Settings. The database stores only a hash of the browser pairing token.

## Pasted-link server preview

Browsers cannot reliably fetch arbitrary product pages because of cross-origin restrictions. An optional authenticated Supabase Edge Function is included at:

`supabase/functions/product-preview`

Deploying it enables rich previews when a URL is pasted directly into the JustGlance web/iOS app. If it is not deployed, JustGlance safely falls back to URL/hostname parsing; the Chrome extension still gets rich metadata because it runs on the actual product page.

## Database

Run only the additive migration:

`supabase/migrations/004_smart_shopping_browser_bridge.sql`

It adds product metadata columns and the revocable browser bridge. It does not delete or replace existing tasks, shopping items, lists, spaces, members, invites, captures, events or projects.

## Deployment

No GitHub workflow changes are included. `/life` continues to publish through the repository's existing shared `web-pages.yml` workflow.
