# WhatMod — Seller Tool Hub

An independently built Whatnot seller tool landing page, tool library, and optional **Stripe Checkout + Cloudflare Worker + D1** supporter licensing starter.

## What is included

- Responsive dark landing page, example dashboard hero, searchable/filterable tool directory and detail dialogs.
- Seven sample listings based on tools you have discussed. **Demo copy and availability do not imply public releases.** Set real URLs and accurate statuses yourself.
- Fixed and custom whole-dollar support payments ($10–$500), one-time only.
- Stripe-hosted Checkout, server-side payment verification, license key issue/validation, webhook processing and D1 persistence.
- License claim/verification page. It saves the user's key locally and offers Copy.
- A minimal `/api/verify` endpoint for integrating with each premium app.

## 1. Publish the frontend without disturbing existing projects

Copy `index.html`, `styles.css`, `app.js`, `projects.js`, `config.js`, `license.html`, `license.js` into your existing GitHub Pages repository root. Keep existing `/track`, `/life`, `/app`, etc. subdirectories and your shared Pages workflow as they are. Do **not** replace the whole repository. Commit and deploy normally.

The homepage can be previewed immediately, **but payments remain disabled** until `config.js` has a Worker API URL.

## 2. Edit the library

Each object in `projects.js` is a tool. Change `availability` (`available` or `development`), `premium`, copy, feature list, category, and `url`. For publicly available tools, use a real HTTPS URL, e.g. the actual download page. `null` intentionally hides the launch button. The tool-details page always reports missing links honestly.

## 3. Deploy payment and license backend

Prerequisites: Cloudflare account with Workers & D1, Stripe account, Node.js and npm for Wrangler CLI. Commands below run in the `worker` folder.

```sh
npm install -g wrangler
wrangler login
wrangler d1 create whatmod-licenses
```

Copy the returned D1 database ID into `worker/wrangler.toml`, and ensure `SITE_ORIGIN` is the exact origin you use (`https://whatmod.com`, no slash or path). Then:

```sh
wrangler d1 execute whatmod-licenses --remote --file=schema.sql
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler deploy
```

Stripe secret must be a valid `sk_test_...` for testing or `sk_live_...` for production. The webhook secret is `whsec_...` from the specific Stripe endpoint. Set the Stripe Dashboard webhook endpoint URL to:

`https://YOUR-WORKER.workers.dev/api/stripe-webhook`

Subscribe to: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `charge.refunded`.

Copy your deployed worker URL into `config.js` under `apiBase` (no trailing slash). Commit and deploy the frontend again. Complete a test Checkout payment with Stripe test mode before switching to live keys.

**Pricing language:** This payment purchases software access. It is not a tax-deductible charitable donation, even if buyers call it a donation. Verify local sales-tax, refund-policy, consumer disclosure, and digital goods requirements before launch. Stripe may impose platform/merchant restrictions.

## 4. Integrate premium features into each app

Each premium app must explicitly implement a license field and gate its own premium functions. This landing page **does not automatically unlock any existing applications**.

A license validity request is:

```http
POST https://YOUR-WORKER.workers.dev/api/verify
Content-Type: application/json
Origin: https://whatmod.com

{"license_key":"WM-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"}
```

Response: `{"active":true}` or `{"active":false}`.

For **browser extensions**, set a strict `host_permissions` entry for your Worker URL and send validation requests from the extension background/service worker, not from a random website page. You may need to extend the Worker's CORS allowlist to extension origins, or handle extension calls whose `Origin` header is absent; **do not change it to wildcard access without designing abuse protections**. Existing Worker code only accepts `Origin: https://whatmod.com` for `/api/verify`, so extensions WILL NOT validate directly until you build that integration. An extension also needs to persist the license and use the returned status to enforce premium feature gating.

For web apps hosted at whatmod.com subpaths, verification works with the default origin. If apps are hosted on other origins, explicitly allow those separately.

## Security and operations notes

- Payment creation and claiming require requests from your website origin; CORS checks are *not* authentication. Add rate limiting (Cloudflare WAF / Turnstile) before broad public launch.
- `session_id` is a bearer secret. Anyone with a valid paid session ID can claim the key. The implementation only displays the key on the Stripe success redirect and supports no authenticated owner recovery. **Do not share success URLs.** A production implementation should email the key to the verified payer or provide verified email-based recovery.
- Keys are persisted in plaintext *and* hashed in D1 to support idempotent claiming. Protect your D1 access. For stronger security, encrypt license keys at rest and add account-bound redemption.
- A copied key can be shared. This simple licensing starter does not implement device binding, activation limits, or authenticated user accounts.
- Refund webhook revokes licenses for matched Checkout sessions. Configure Stripe webhooks and verify behavior with test payments. Disputes/chargebacks are **not automatically handled**; add those events before production.
- Consider retries/out-of-order webhook events, audit logs, email receipts and an admin panel before taking meaningful payment volume.
- The illustrated dashboard numbers in the homepage hero are **decorative demo metrics**, not real sales data.
- This is independent software and is not affiliated with Whatnot. Verify app behavior against Whatnot's terms and policies.

## File map

- `index.html`: homepage markup
- `styles.css`: full responsive design
- `projects.js`: tool catalog
- `app.js`: filtering, details, checkout
- `config.js`: public configuration (no secrets)
- `license.html` and `license.js`: claim and verification UI
- `worker/worker.js`: backend
- `worker/schema.sql`: D1 tables
- `worker/wrangler.toml`: Worker deployment config
