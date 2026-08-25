# Aurelium — Small Business Website Service

A polished static marketing site designed for GitHub Pages.

## Customize your contact information

Open `script.js` and change these three lines:

```js
const AURELIUM_EMAIL = "hello@yourdomain.com";
const AURELIUM_PHONE_DISPLAY = "(000) 000-0000";
const AURELIUM_PHONE_TEL = "+10000000000";
```

The contact form now submits in the background using FormSubmit's AJAX endpoint, so visitors stay on the Aurelium page and receive an inline success/error message.

### One-time activation
After replacing the placeholder email with your real receiving email, submit the form once on the live site. FormSubmit will send an activation email to that address. Click the activation link once; after that, customer inquiries will be delivered normally.

The form also includes a honeypot spam field and visible error handling.

## Deploy to GitHub Pages

1. Put these files in your desired repository/folder.
2. Commit and push.
3. In GitHub: Settings → Pages.
4. Set the deployment source to the branch/folder containing this site.

Files:
- `index.html`
- `styles.css`
- `script.js`

## Optional next upgrade

For a true background form submission with no mail-app handoff, connect Formspree, Basin, Web3Forms, or a Supabase Edge Function.
