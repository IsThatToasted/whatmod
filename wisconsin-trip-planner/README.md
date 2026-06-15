# Bedroom Compatibility Builder

Static GitHub Pages app backed by Supabase Auth, Postgres, RLS, and Realtime.

## Setup

1. In Supabase, enable **Google** under Authentication → Providers.
2. Add your GitHub Pages URL to Authentication → URL Configuration → Redirect URLs.
3. Run `supabase-schema.sql` in the SQL editor.
4. Confirm `config.js` has your Supabase URL and publishable/anon key.
5. Open the app from GitHub Pages.

## Flow

- User signs in with Google.
- User creates a display profile attached to their auth account.
- User creates a private compatibility builder.
- App generates an invite link with `?session=<session id>`.
- Partner opens the link, signs in with Google, and joins the same builder.
- Each person answers on their own time.
- Cards update live on both clients when either person answers.
- Green means compatible, red means not compatible, yellow means waiting.
- Final compatibility percentage only appears after both users answer every question.

## Files

- `index.html` - app layout
- `styles.css` - dark modern UI
- `app.js` - auth, profile, invite sessions, answers, live sync, scoring
- `config.js` - Supabase config
- `supabase-schema.sql` - database/RLS/realtime schema
