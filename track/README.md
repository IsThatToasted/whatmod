# WeTrack — V1.0 Rebrand + iOS Wrapper Checkpoint

This build rebrands the current ItineraryTrackerV2.3 app to **WeTrack** while preserving the existing GitHub Pages + Supabase app under `/track`.

Build marker: `WeTrack V1.0.0 / V2.3.10-rebrand-ios-2026-07-19` / cache version `v=300`.

## Web deployment

Upload the contents of this ZIP into your existing `whatmod` repo under the `track/` folder, preserving the existing path so the web app remains available at:

```text
https://whatmod.com/track
```

The Supabase URL, public key, database tables, license gates, maps, memories, Fun Ideas, shopping lists, and current app features are preserved.

## iOS app wrapper

This checkpoint adds a native iOS wrapper under:

```text
ios/WeTrack
```

The iOS app uses SwiftUI + WKWebView to load the live web app at `https://whatmod.com/track/`. That means the iOS app can be shipped without duplicating the existing Supabase/web logic. The web app remains the source of truth, and future web updates continue to work inside the iOS app.

## GitHub Actions IPA build

A starter workflow is included for your repo root at:

```text
repo-root/.github/workflows/ios-ipa.yml
```

Copy the contents of the `repo-root/` folder into the root of your `whatmod` repository. The workflow expects the iOS project to live at `track/ios/WeTrack/WeTrack.xcodeproj`, which matches this ZIP once the web files are uploaded into the `track/` folder.

To build a real installable IPA, add these GitHub repository secrets:

- `APPLE_CERTIFICATE_BASE64` — base64 encoded `.p12` signing certificate
- `P12_PASSWORD` — password for the `.p12` certificate
- `PROVISIONING_PROFILE_BASE64` — base64 encoded `.mobileprovision` profile
- `APPLE_TEAM_ID` — your Apple Developer Team ID
- `IOS_BUNDLE_ID` — usually `com.whatmod.wetrack`

Then run the **Build WeTrack iOS IPA** workflow manually from GitHub Actions.

## Local license key generator

The existing license generator remains in:

```text
tools/license_key_generator.py
tools/run_license_generator_windows.bat
```

Use it to generate SQL commands for Supabase license keys and user entitlements.

## Notes

- No schema change is required for this rebrand/iOS wrapper patch.
- Keep existing `schema.sql` for full project setup/recovery.
- The iOS wrapper is intentionally thin so it does not risk breaking the live web app.

---

# ItineraryTrackerV2.3.2 UI Redesign

Production UI redesign checkpoint based on the latest stable V2.2 licensing/mobile-layout build.

This is primarily a UI/layout pass. Existing Supabase auth, trip data, licensing/entitlements, memories, maps, Fun Ideas, shopping lists, Traveler Passport, and collaboration logic are preserved. No new schema is required for the UI redesign itself.

Deploy `index.html`, `settings.html`, `app.js`, `styles.css`, `schema.sql`, `assets/`, `content/`, and `tools/` to your `/track` GitHub Pages path.

Build marker: `V2.3.2.0-ui-redesign-2026-07-12` / cache version `v=230`.

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


## V2.2.1 patch
- Cleaned up Fun Ideas permission rows so each traveler displays as a single avatar + name + role + toggle.
- Removed duplicated/overlapping assignee chip rendering in the permissions panel.
- No schema change required.


## V2.2.8 Licensing / Premium Gates

Run `schema.sql` once after deploying this version.

Premium gates included in this build:

- Free users: up to **5 events per day**.
- Premium users: up to **25 events per day**.
- Shopping List pill on shopping events only appears for Premium users.
- Maps/routes are Premium-only.
- Photo Memories and completed-trip recap/slideshow are Premium-only.

To create a license key in Supabase SQL Editor:

```sql
insert into public.itinerary_license_keys(license_key, max_redemptions)
values ('TEST-PREMIUM-123', 1);
```

A user can click the small Free/Premium badge in the app to redeem a key.

## Fun Ideas reactions

This build replaces fragile client upserts with the `upsert_trip_fun_reaction()` RPC helper. Slider movement updates the UI immediately, then saves once after the user pauses/releases the slider. It should feel live without repeatedly hammering Supabase.


## V2.2.11 toast/license/memory gate fix
- Fixes `showToast is not defined` during license redemption.
- Blocks Free users from opening Add Memory/camera before Premium is redeemed.
- Bumps app/styles cache to v94 and build badge to V2.2.11.

## V2.2.12 Licensing / Entitlements

This build upgrades licensing from a simple Free/Premium switch to configurable per-user entitlements.

Run `schema.sql` once after uploading this build.

### Default behavior

Free users:
- 5 events per day
- 1 trip
- Maps disabled
- Shopping lists disabled
- Photo memories disabled
- Completed-trip recap disabled

Premium users by default:
- 25 events per day
- 25 trips
- Maps enabled
- Shopping lists enabled
- Photo memories enabled
- Completed-trip recap enabled

### Create a customizable license key

```sql
insert into public.itinerary_license_keys(
  license_key,
  max_redemptions,
  events_per_day,
  max_trips,
  enable_maps,
  enable_memories,
  enable_shopping_lists,
  enable_recaps
) values (
  'TOASTED-ADMIN-001',
  1,
  25,
  25,
  true,
  true,
  true,
  true
);
```

### Manually adjust a user's Premium access

Run this from Supabase SQL Editor as the project owner:

```sql
select public.admin_set_itinerary_entitlement_by_email(
  'user@example.com',
  'premium',
  true,
  40,   -- events per day
  10,   -- max trips
  true, -- maps
  true, -- memories
  false,-- shopping lists
  true, -- recaps
  'Manual adjustment'
);
```

You do not need a Windows licensing app for the first version. Supabase can store and enforce the license status now. Later, this can become a small admin dashboard or Stripe webhook/Edge Function.


## License key generator helper

This package includes a small local Python helper at:

```text
tools/license_key_generator.py
```

On Windows, open the `tools` folder and double-click:

```text
run_license_generator_windows.bat
```

Or run from a terminal:

```bash
cd tools
python license_key_generator.py
```

The helper does not connect to Supabase and does not need any secrets. It only generates SQL commands that you can paste into the Supabase SQL Editor for:

- New license keys
- Custom events-per-day limits
- Custom max-trip limits
- Feature toggles for maps, memories, shopping lists, and recaps
- Direct entitlement grants to a user email

## V2.3.2.1 Shopping list ordering + budget costs

This patch adds shopping-list item drag/drop ordering and an estimated-cost field for each shopping item. Shopping item costs are included in the trip's estimated budget total. Run `schema.sql` once so Supabase adds `estimated_cost` and `sort_order` to `itinerary_shopping_items`.


## V2.3.2 Travel Expense / Budget separation
- Flight events now have ticket, checked baggage, and other flight cost fields.
- Drive/transit/gas blocks now have a driving/gas cost field.
- Other travel costs can be entered on travel-type events.
- Travel Expense is displayed separately from normal Planned Budget.
- Normal Budget remains for activities, lodging, food, shopping, and Must Do costs.
- Run `schema.sql` once to add the new travel-expense columns.


## V2.3.2 Hotel/Lodging Travel Expense Patch
- Hotel/lodging event budget values now count under Travel Expense instead of Planned Budget.
- Planned Budget now excludes all travel-type event budgets: flight, train, ferry, cruise, drive, transport, gas, hotel, and lodging.
- Travel Expense includes explicit flight/drive fields plus travel-type event budget fallback values.

## V2.3.7 Shopping Aisles / Grocery Categories

Shopping lists now support grocery-style categories so users can shop in aisle order. Added categories include Produce, Meat & Seafood, Dairy & Eggs, Bakery, Pantry, Frozen, Snacks, Drinks, Household, Personal Care, Baby/Toddler, Pet, Pharmacy, and Other.

Each shopping item has:
- item name
- quantity
- estimated cost
- category
- notes
- completion state
- drag/reorder support

Shopping list estimated costs still roll into the trip's planned budget.

Run `schema.sql` once to add the `category` column/index.


## V2.3.7 Mobile Overflow Lock

- Locked unintended horizontal page scrolling across the app.
- Shopping List modal now scrolls vertically only and wraps category/item rows cleanly on mobile.
- Preserved intentional horizontal day-tab navigation.


## V2.3.7 Mobile Shopping Dialog Restore
- Restores mobile shopping list modal to desktop-like dialog behavior.
- Removes bottom-sheet collapse behavior while scrolling.
- Keeps entire dialog vertically scrollable and viewport-constrained.
- Keeps horizontal overflow locked.

## V2.3.8 live reactions patch

This build hardens Fun Ideas reaction sliders:
- Slider emoji/label updates immediately while dragging.
- The viewer's own reaction is saved locally instantly, then synced to Supabase after a short pause/release.
- Other travelers' reactions update through Supabase Realtime when available.
- A lightweight 4.5-second poll runs only while the Fun Ideas popup is open as a fallback if Realtime is delayed.
- Existing collaborative tables still use the app's realtime/fallback refresh behavior.

Run `schema.sql` once after deploying to ensure `trip_fun_reactions`, the save RPC, RLS policies, indexes, and Realtime publication are in place.

Build marker: `V2.3.8-live-reactions-2026-07-14`

## iOS unsigned IPA workflow fix

This package includes a corrected workflow at:

`repo-root/.github/workflows/ios-ipa.yml`

It builds an unsigned IPA for Sideloadly and does **not** require Apple signing secrets. Copy `repo-root/.github` to the root of your `whatmod` repo. The app still lives under `/track`.

Use Sideloadly locally with your Apple ID, for example `Toasted3@icloud.com`, to sign/install the generated unsigned IPA.
