# WeTrack V2.9 Stabilization Audit

## Scope
Deep static audit of the uploaded V2.8 working package, focused on data duplication, onboarding persistence, realtime wiring, repeated listeners, cache/deployment safety, and high-risk collaborative flows.

## Fixed production issues

### 1. Packing list duplication — FIXED
**Root cause:** `loadPackingItems()` could be entered from initial trip load and realtime/silent refresh at nearly the same time. Both callers could observe an empty list and independently insert the eight starter items.

**Fixes:**
- Added one in-flight seed promise in the client.
- Added stale-response protection when switching trips/accounts.
- Added `ensure_itinerary_starter_packing(uuid)` server RPC with a transaction advisory lock.
- Added a partial unique index covering only the eight built-in starter labels.
- Added a one-time SQL repair that removes duplicate built-in starter rows only. Custom packing rows are untouched.
- If any duplicate copy was checked, the retained row remains checked.
- Added client-side starter deduplication so the UI is clean even before the repair SQL is applied.

### 2. Onboarding repeatedly appearing — FIXED
**Root cause:** older builds could successfully save onboarding to `itinerary_trip_members` when the newer `itinerary_user_profiles` save was unavailable. The onboarding display check later trusted only the account-level completion flag.

**Fixes:**
- Completion now resolves from account profile OR trip member OR the per-user local completion marker.
- If the member cache is not ready, onboarding queries the current member directly before opening.
- SQL backfills `itinerary_user_profiles.onboarding_completed=true` for users who previously completed onboarding on any trip.
- Existing profile values are preserved/merged during the backfill.

### 3. Must Do realtime typo — FIXED
The realtime subscription/publication used `itinerary_must_do`, while the real table is `itinerary_must_do_items`. This silently prevented genuine Must Do realtime updates. Both app and schema now use the correct table.

### 4. Redundant starter cleanup RPC calls — FIXED
Memory photo code was resetting the unrelated `starterCleanupChecked` guard. Taking/deleting memories could therefore make a later trip reload rerun the duplicate starter-trip cleanup RPC. Those resets were removed.

## Audited and retained
- Existing Fun Ideas persistent bucket/reaction implementation left intact.
- Existing memory picker capture-phase guard retained because it intentionally suppresses older duplicate picker listeners.
- Existing capture-phase trip deletion handler retained because it intentionally supersedes a legacy deletion path.
- No duplicate HTML IDs found.
- All application `.from(...)` database table references resolve to schema tables; `trip-memories` is correctly a Storage bucket rather than a SQL table.
- `app.js` passes `node --check`.
- No direct SQL deletion from `storage.objects` was introduced.
- Existing iOS project files are preserved unchanged.

## Deployment requirement
Run `v29_stabilization_repair.sql` once after deploying V2.9. It is safe to run more than once. The full `schema.sql` contains the same migration at the end.

## Cache/build
- Web cache: `v480`
- Build: `WeTrack V2.9.0`
