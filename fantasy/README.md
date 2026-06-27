# Fantasy Vault — Mobile Dating Prototype + Google Login

Static local prototype for `whatmod.com/fantasy` with Supabase Auth, Google login, local fallback, profile sync, and Vault ratings.

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
