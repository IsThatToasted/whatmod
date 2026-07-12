# ItineraryTrackerV2.2 — Production Stabilization

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


## v52 patch

- Mobile Settings shortcut appears near the bottom of the app on phones.
- Shopping itinerary cards now show a **List** pill.
- Shopping lists are shared per shopping event with item add/edit/delete/complete.
- Shopping lists are now public to all trip collaborators, so there is no per-user access UI to maintain.
- Run `schema.sql` once to add the shopping list tables and realtime support.

## v60 Cleanup tightening

This build adds:
- Safer trip deletion through `delete_itinerary_trip_cascade()`.
- Automatic cleanup of duplicate empty `My Trip` / `New trip` starter records for the signed-in user.
- Storage cleanup for memory photos when a trip is deleted.
- No automatic creation of a new `My Trip` after deleting the last trip; the app now prompts you to create one instead.

Run `schema.sql` once in Supabase SQL Editor before testing deletion/cleanup.


## V2.1 Final Polish Notes

This checkpoint adds a completed-trip memory mode and storage/performance hardening.

- Completed trips automatically show a Memories recap panel instead of the active planner.
- The recap uses saved photo memories with soft transitions and an optional generated ambient audio button. Browsers require a tap before audio can play.
- The planner is still available from the completed-trip panel with **Open planner**.
- Memory uploads are compressed client-side where possible before upload to reduce Supabase Storage usage.
- Memory deletion now also attempts to remove the associated file from the `trip-memories` Storage bucket.
- Trip deletion attempts to remove memory photo files through the Supabase Storage API before deleting the trip/database rows.
- The schema avoids direct SQL deletion from `storage.objects`, because Supabase blocks that for safety.

Run `schema.sql` once after deploying this version so the Storage delete policy and cleanup helpers are current.

## V2.1.14 profile / UI polish patch
- Activity Generator search input now gets its own row above radius/GPS/generate controls.
- Desktop timeline action buttons have consistent compact spacing.
- Traveler avatars appear beside the day planner title; click/tap a traveler to view their profile.
- Clicking your own avatar opens your profile editor.
- Fun Ideas moved from the profile avatar to a lock icon beside notifications. Owners see it; invited users see it only when Fun Ideas access is enabled.
- `schema.sql` adds optional traveler profile preference fields on `itinerary_trip_members`.


## V2.1.15 Traveler Passport

Adds a polished Traveler Passport profile modal with trip role, nickname, food preferences, foods to avoid, activity preferences, rainy-day picks, outdoor favorites, shopping interests, travel style chips, budget comfort, wake-up time, logistics notes, and trip notes. Run `schema.sql` once to add the optional profile fields.


## V2.2 stabilization additions

- Agenda view is now available and defaults on for a cleaner production planning experience. Timeline view remains available for detailed drag/drop planning.
- Universal toast/status messages for saves, updates, sync events, and recoverable errors.
- Silent live-sync fallback refreshes trip data periodically, on visibility return, and after realtime broadcasts without interrupting open dialogs/forms.
- No-trip empty state instead of silently creating duplicate starter trips.
- Completed-trip memory recap/slideshow and storage-safe deletion behavior preserved from V2.1.
- Hidden diagnostics panel: press Ctrl/Cmd + Shift + D to view current user/trip/sync state while testing.

Run `schema.sql` after deploying if you have not already run the latest V2.1 schema. No new required schema changes were added specifically for V2.2 UI stabilization.
