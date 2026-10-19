# Aurelium Field v0.15.0 — Build 34
## Exterior Smart Scanner v3

### Why it was rebuilt
v0.14 tried to get wall sizes from ARKit vertical plane anchors. Those are loose bounding rectangles that grow, merge and
drift on flat siding, so every downstream number inherited the error. It also summed overlapping planes, had no real
height for multi-story walls (LiDAR sees ~5 m), mapped Vision rectangles to the screen without ARKit's display transform
(overlays and confirm raycasts landed in the wrong place), and offered no per-elevation structure.

### New approach: define the wall, then measure on it
1. **Footprint.** Aim the crosshair at each building corner where wall meets ground, tap Mark Corner. Corners define
   vertical wall planes mathematically. Re-marking Corner 1 closes the loop, reports drift, and spreads it across the loop
   (compass rule). Four-corner buildings that are near-rectangular are squared up using averaged opposite sides.
2. **Instant ballpark.** After the footprint, perimeter x story height gives a live estimate, clearly flagged "heights assumed".
3. **Wall measuring.** The wall you aim at is auto-selected (or lock it). Eave height, gable apex and opening corners are
   camera rays intersected analytically with the known wall plane, so range limits and plane detection no longer matter.
   Works without LiDAR.
4. **Opening detection that sticks.** Vision rectangles are projected into wall coordinates, rejected unless upright and
   plausibly sized, fused across frames (median), auto-classified (window / door / garage door / opening) by size and
   height-above-grade priors, and offered as chips. One tap accepts, long-press changes type or dismisses, "Accept likely"
   bulk-accepts stable ones. Results are dropped if the camera moved while Vision ran. Nothing enters the takeoff without a user action.
5. **Gables and roof pitch** from a single apex tap; area and pitch derived.
6. **Photos** per elevation (elevation / damage-prep tags) attach to the existing evidence sync.
7. **Review.** Scan confidence (High/Medium/Low) with plain-language reasons; surface, condition, application, coats, deduct
   policy, trim; per-wall and per-opening editing; labor by wall using working-height access factors.

### Estimating model
Walls: net area / (base rate x surface x application x access-by-height) x coats/2 x (1 + prep). Trim = opening casing + fascia
along the footprint. Garage doors are priced per door. **Surface, condition, application and access multipliers are starting
planning defaults, not validated numbers.** Tune the base rate (default 150, unchanged) to your crews' real production.

### Data / sync (login and Supabase transport untouched)
- Full wall/opening model is saved as JSON in the walkthrough's existing JSON slot, so it uploads through the existing path.
- New best-effort table `exterior_scan_details` (migration 015). If it is not applied, nothing breaks.
- Learning samples now include confirm / edit / reject / manual-add events with predicted vs final sizes.
- Fixed: exterior learning samples were inserted concurrently with the walkthrough row and could silently fail the foreign key.
  `AppModel.addExteriorWalkthrough` now syncs sequentially.

### Files
New: `ExteriorGeometry.swift`, `ExteriorDetailCloudSync.swift`, `ExteriorScanViews.swift`.
Rewritten: `ExteriorSmartScanService.swift`. Trimmed: `SmartScannerV2View.swift` (mode picker only).
Edited: `AppModel.swift` (one function), `project.yml`, `Info.plist`.
Byte-identical: `WorkspaceService.swift`, `AuthView.swift`, `AureliumFieldApp.swift`, `AuthGate.tsx`, `supabase.ts`. Web app unchanged.

### Database
Run only `015_exterior_scanner_v3.sql` after 014.

### Known limits
Not yet compiled or field-tested by the author. Run the CI build and test on a real house before relying on numbers.
Heights/openings are only as good as ARKit tracking; wall corners hidden by shrubs need aiming at the vertical corner edge.
Curved or non-planar walls are not modeled. Interior Smart Scanner and Blueprint Estimate unchanged.
