# Fantasy Vault — Dating Prototype

Mobile-first local/Supabase prototype for a sex-positive dating app concept.

## Run locally
Open `index.html` in a browser.

## Host at whatmod.com/fantasy
Upload the folder contents into the `/fantasy` path on your host/GitHub Pages build.

## Change hosting path later
Edit `config.js`:

```js
APP_BASE_PATH: '/fantasy'
```

Change that to `/`, `/vault`, `/dating`, etc. Nothing else should need to change for the base path.

## Supabase
The Supabase URL and publishable key are in `config.js`.

Run `supabase-schema.sql` in the Supabase SQL Editor to enable prototype syncing.

Important: the included RLS policy is intentionally open for prototype testing. Before real users, replace it with Supabase Auth and user-owned row policies.

## What's included
- Dating-style discovery cards
- Nearby / chemistry / new filters
- Mobile bottom navigation
- Fun emoji Fantasy Vault cards
- Different card colors by category
- Local fallback via localStorage
- Supabase upsert sync for profile, ratings, likes, and passes
