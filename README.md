# WhatMod Website

Static sales page for WhatMod. Ready for GitHub Pages.

## File structure

```text
whatmod/
├── index.html
├── styles.css
├── script.js
├── README.md
└── assets/
    └── cover.png
```

## Stripe setup

The Stripe dashboard product URL is private/admin-only and cannot be used as a checkout link.

Create a Stripe Payment Link for the existing WhatMod 1 Month / 30 Day subscription product, then open `script.js` and replace:

```js
const STRIPE_PAYMENT_LINK = "PASTE_YOUR_STRIPE_PAYMENT_LINK_HERE";
```

with your public link, which should look like:

```js
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/...";
```

## GitHub Pages cache busting

This version already uses cache-busting query strings:

```html
styles.css?v=20260509-2
script.js?v=20260509-2
assets/cover.png?v=20260509
```

When you update CSS or JS, change those version numbers in `index.html`, commit, wait for Pages to deploy, then hard refresh with Ctrl+Shift+R.

## Important

Make sure `index.html` starts with:

```html
<!doctype html>
```

If it starts with PNG/binary text, the image was accidentally uploaded over `index.html`.
