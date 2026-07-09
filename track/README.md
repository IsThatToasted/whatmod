# ItineraryTrackerV2.1 Production UI

Checkpoint build focused on PC/tablet display polish, mobile quick navigation, and camera-first memories.

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


## Trip creation RLS fix
If you see `new row violates row-level security policy for table itinerary_trips`, rerun the included `schema.sql`. This version adds `create_itinerary_trip(...)`, a secure Supabase RPC used by the app to create the trip and owner membership together.


## Latest update: smarter overlaps + new categories

This version adds more event types (Sightseeing, Activity, Flight, Transit/Pickup, Shopping, Rest/Downtime, Toddler-friendly) and changes overlap handling so logistics/travel blocks like flights, drives, pickups, hotel check-ins, gas stops, rest blocks, and reminders do not trigger red conflict warnings when they overlap normal plans. They show a softer informational same-time note instead.

## v31 Production polish notes

This version keeps the existing Supabase structure and adds mostly frontend polish:

- Polished event cards with icon, category pill, cost pill, rain-plan badge, assignee/everyone badge, and cleaner map-location row.
- Live weather provider layer using Open-Meteo when the trip is within the available forecast window.
- Weather chips on day tabs and a selected-day weather summary card.
- Weather data is cached in the browser for about 45 minutes to avoid unnecessary requests.
- No required schema change for weather in this version.

Weather note: forecasts only appear when the trip dates are close enough for live forecast data. For far-future trips, the app shows a friendly “forecast unlocks” message instead of failing.

## v32 Home dashboard + card locks

Run `schema.sql` once after uploading this version. It adds `locked`, `locked_by`, and `locked_at` to itinerary cards.

Locked cards can still be viewed, but cannot be dragged, resized, shifted, edited, deleted, or have rain plans changed until an owner/editor taps Unlock on that card.


## ItineraryTrackerV2 settings patch
- Added `settings.html` as a real standalone settings page instead of a sidebar anchor that scrolls the planner.
- Sidebar Settings now opens `settings.html`.
- Desktop/tablet card action dock spacing was tightened so buttons stay inside the right side of event cards.
- No Supabase schema change is required for this patch.


## ItineraryTrackerV2 mobile nav patch

This patch updates the mobile quick nav to: Home, Must Do, Add Memory, and Packing. Add Memory opens the camera/photo picker flow directly. The nav stays sticky at the top, fades after 10 seconds of inactivity while scrolled, and wakes back up when the user scrolls/touches the page.


## V2.1 Production UI Revamp

This checkpoint focuses on moving the app from feature-complete prototype toward a product-ready interface.

### Added / polished
- Three selectable themes: Purple Glow, Clean Light, and Night Mode.
- Theme picker in the top bar and Settings page.
- Unified glass-card design system with consistent shadows, radii, spacing, and color tokens.
- Reworked dashboard/home card styling.
- Polished trip hero, summary metrics, day tabs, side panels, modals, and route panel.
- Rebuilt desktop/tablet event-card layout so short and tall cards use the same contained action dock.
- Preserved the mobile quick nav and existing Supabase/data functionality.

No new Supabase schema is required for the UI revamp.
