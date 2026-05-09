[README.md](https://github.com/user-attachments/files/27552653/README.md)
# WhatMod Website

Static GitHub Pages website for WhatMod.

## Files

- `index.html` — homepage
- `styles.css` — design/styling
- `script.js` — menu, animations, Stripe redirect
- `assets/cover.png` — hero/cover image

## Stripe Setup

GitHub Pages is static, so the safest no-backend Stripe setup is a Stripe Payment Link.

1. Open Stripe Dashboard.
2. Go to Payments > Payment Links.
3. Create a Payment Link for your existing WhatMod monthly/30-day subscription product.
4. Copy the customer-facing link. It should look like `https://buy.stripe.com/...`.
5. Open `script.js`.
6. Replace:

```js
const STRIPE_PAYMENT_LINK = "";
```

with:

```js
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/YOUR_LINK_HERE";
```

7. Commit/push to GitHub.

Do not put Stripe secret keys in this static website.
