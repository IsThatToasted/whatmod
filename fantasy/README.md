
## OAuth redirect fix

This build no longer uses a hardcoded `AUTH_REDIRECT_URL`. The Google login button now sends Supabase back to the exact page currently loaded in the browser.

For GitHub Pages at `https://whatmod.com/fantasy/`, Supabase must include these redirect URLs:

```txt
https://whatmod.com/fantasy/
https://whatmod.com/fantasy
```

If you still land on `http://localhost:3000/#access_token=...`, the hosted site is almost certainly still serving an older cached `app.js` or `config.js`. Re-upload/commit all files from this zip, then hard refresh the browser with Ctrl+F5. You can also open DevTools Console and check for:

```txt
[Fantasy Vault] Google OAuth redirectTo: https://whatmod.com/fantasy/
```

If it says localhost, the live site is not running this patched build.

# Fantasy Vault — Mobile Dating Prototype + Google Login

Static local prototype for `whatmod.com/fantasy` with Supabase Auth, Google login, local fallback, profile sync, and Vault ratings.


## Fixing OAuth redirect location

The login return URL is controlled in `config.js`:

```js
AUTH_REDIRECT_URL: 'https://whatmod.com/fantasy/'
```

For local testing, temporarily change it to the local URL you are actually using, for example:

```js
AUTH_REDIRECT_URL: 'http://localhost:8080/'
```

Whatever value you use must also be added in Supabase under **Authentication → URL Configuration → Redirect URLs**.

Recommended production values:

```txt
Site URL: https://whatmod.com/fantasy/
Redirect URLs:
https://whatmod.com/fantasy/
https://whatmod.com/fantasy
http://localhost:8080/
http://localhost:8080
http://127.0.0.1:5500/
http://127.0.0.1:5500
```

If Supabase sends you to `http://localhost:3000/#access_token=...`, it usually means your Supabase **Site URL** is still set to `http://localhost:3000`, or the app requested a redirect URL that is not allow-listed.


## Run locally

Because Google OAuth redirects do not work reliably from `file://`, run a tiny local server:

```bash
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

## App config

Edit `config.js` when the app moves:

```js
APP_BASE_PATH: '/fantasy'
```

For `https://whatmod.com/fantasy`, keep `/fantasy`.
For a root domain later, change it to `/`.

## Supabase setup

Project URL already configured:

```text
https://gqkkdocvfstbsekxyrbo.supabase.co
```

1. In Supabase, open **SQL Editor**.
2. Run `supabase-schema.sql`.
3. Go to **Authentication → Providers → Google**.
4. Leave that page open because it shows your Supabase callback URL:

```text
https://gqkkdocvfstbsekxyrbo.supabase.co/auth/v1/callback
```

5. Paste your Google OAuth Client ID and Client Secret there after creating them in Google Cloud.
6. Go to **Authentication → URL Configuration**.
7. Set **Site URL** to:

```text
https://whatmod.com/fantasy
```

8. Add these **Redirect URLs**:

```text
https://whatmod.com/fantasy/
https://whatmod.com/fantasy
http://localhost:8080/
http://localhost:8080
```

## Google Cloud setup

1. Go to Google Cloud Console.
2. Create/select a project.
3. Open **APIs & Services → OAuth consent screen**.
4. Choose **External** unless this is only for a Google Workspace organization.
5. Fill in app name, user support email, developer contact email.
6. Add authorized domain:

```text
whatmod.com
```

7. Save, then open **APIs & Services → Credentials**.
8. Click **Create Credentials → OAuth client ID**.
9. Application type: **Web application**.
10. Authorized JavaScript origins:

```text
https://whatmod.com
http://localhost:8080
```

11. Authorized redirect URIs:

```text
https://gqkkdocvfstbsekxyrbo.supabase.co/auth/v1/callback
```

12. Copy the **Client ID** and **Client Secret** into Supabase **Authentication → Providers → Google**.
13. Enable the Google provider.

## Important notes

- The publishable Supabase key is safe to expose in frontend code, but the Google Client Secret is not. Only paste the Client Secret inside Supabase, never inside `config.js`.
- Keep the app in Google OAuth testing mode while prototyping. Add your Gmail as a test user if Google asks for it.
- Before real launch, add age verification, moderation, report/block tools, and stricter profile visibility rules.

## Login + 18+ landing flow

The landing screen now requires both steps before the app opens:

1. User confirms they are 18+.
2. User signs in with Google through Supabase Auth.

After Google redirects back to the app, Fantasy Vault automatically opens only when a valid Supabase session exists. Signing out returns the user to the landing/auth screen.
