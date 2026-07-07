# Itinerary Tracker for GitHub Pages + Supabase

Static app intended for: `https://whatmod.com/track/`

## What this version adds
- Signed-in collaborator access
- Owner/editor/viewer trip roles
- Invite links like `https://whatmod.com/track/?invite=...`
- Invited users must sign in before the trip is added to their account
- Editors can update trip details and itinerary items
- Viewers can see the itinerary but cannot edit

## Files
- `index.html` — app shell
- `styles.css` — responsive dark UI
- `app.js` — Supabase auth, invite acceptance, shared CRUD logic
- `schema.sql` — Supabase tables, RLS policies, invite RPC function

## Supabase setup/update
1. Open Supabase SQL Editor.
2. Paste and run the full `schema.sql` file.
3. This is safe to rerun. It backfills owner memberships for existing trips.
4. Go to Authentication → URL Configuration.
5. Set Site URL to `https://whatmod.com/track/`.
6. Add Redirect URLs:
   - `https://whatmod.com/track/`
   - `https://whatmod.com/track`
   - `https://whatmod.com/track/?invite=*`
7. Enable Google provider or magic-link email login.

## GitHub Pages deployment
Place these files in a `/track` folder in your GitHub Pages repository so the final URL is:

`https://whatmod.com/track/`

The Supabase URL and publishable key are already configured in `app.js`.

## How invites work
1. Trip owner/editor signs in.
2. Opens the trip.
3. Chooses `Can edit` or `View only`.
4. Clicks `Create invite link`.
5. Sends the copied link to the other user.
6. The invited user opens the link and signs in.
7. The app accepts the invite and adds that trip to their trip list.

### v18 Rain Plan update
Run `schema.sql` again in Supabase to add the optional `rain_plan` field to itinerary items. The app will still load without it, but rain plans will only sync between users after the schema update is applied.

Rain Plan behavior:
- Tap the `☔ Rain` button on any itinerary card to flip it.
- On mobile, long-press a card to flip to the rain plan view.
- Use `Edit rain plan` or the normal item editor to add/update the rainy-day backup.
