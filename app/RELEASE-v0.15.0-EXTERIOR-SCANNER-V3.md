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

---
# v0.15.1 — Build 35 (scanner feedback pass)

**Ground detection is no longer "tight".** The crosshair now falls back in three steps: ARKit plane hits (existing or
estimated) -> geometric intersection with the ground height already learned -> an *estimated* ground at typical hand-held
height, so you can always start a corner where you want. Estimated ground shows an orange crosshair and orange Mark button
and the corner is flagged in the confidence report. Decks/porches far from the known ground level are ignored as "ground".

**Blocked corners (bushes, steps, cars).** New **Blocked** menu beside Mark Corner:
- *Use wall surface at crosshair*: aim at the vertical corner edge anywhere you can see it.
- *Square to previous wall (perspective)*: the crosshair ray is intersected with the vertical plane the next wall must lie
  in, so the hidden base never has to be seen.
- *Straight along previous wall*: same idea for a collinear wall.
- *Complete rectangle (auto 4th corner)*: after 3 corners, the 4th is computed and the loop closes.
Assumed corners are counted in the scan confidence and saved in the scan detail.

**3D model of the exterior.** On save, a USDZ (ground footprint, walls, gables, color-coded windows/doors/garage doors) is
generated from the measured geometry and stored in the same slot as the interior model, so "Open saved 3D model", cloud
upload and deletion all work with no sync changes. If SceneKit cannot write the file the scan still saves without a model.
This is a simple massing model, not a photoreal or LiDAR-mesh capture.

**Video hidden.** `ScanFeatureFlags.walkthroughVideo = false` stops interior recording, hides the status text, the player
and the "Video unavailable" box. Flip the flag to bring it back later. Existing recordings are untouched.

**Photo gallery.** Tagged photos (PAINT, COVER, DAMAGE, DO NOT DISTURB, REMOVE) are tappable in the walkthrough review,
the exterior review (thumbnail strip) and the scanner (More > View photos). Full-screen viewer: pinch or double-tap to zoom,
swipe through every photo, "n of N" counter, tag/wall/time caption, Close button. The exterior More menu now has all five tags.

New files: `EvidenceGalleryView.swift`, `ScanFeatureFlags.swift`. Edited: `EstimatorView.swift` (video flag, gallery, label).
Frozen auth/Supabase files remain byte-identical. Still not compiled by the author; send CI errors if any appear.

---
# v0.15.2 — Build 36 (large and tall facades)

**Root cause of "move the crosshair closer to the ground":** marking a corner required the crosshair to hit the ground. That is
impossible when you raise the phone or aim up at a tall wall, and ground rays become meaningless at long range. The scanner also
had house-scale caps (ray range 90 m, wall height 45 ft, opening width 20 ft, 3 stories).

**Marking corners without seeing the ground**
- Mark Corner now falls back automatically to the wall surface at the crosshair when the ground is not hit.
- Blocked menu rebuilt around big buildings: *Far corner · wall continues straight* and *Far corner · wall turns 90°* (aim at the
  corner's vertical edge at ANY height; the ray is intersected with the wall's vertical plane, so the base is never needed),
  *Wall surface at crosshair (near)*, *Stand at the corner · mark my position*, *Complete rectangle*.
- Long-wall recipe: mark the near corner, walk 20-30 ft along the wall and mark a second base point, step back, aim at the far
  corner's vertical edge, Blocked > Far corner. Collinear points are merged, so a 409 ft elevation is ONE wall.
  Use **Finish with open footprint** when you only need one side (e.g. 49 ft x 409 ft).
- A measured ground hit later replaces an estimated ground height and re-levels corners that were placed on the estimate.

**Scale limits raised:** ray range 90 -> 700 m; far clip plane 2000 m; wall height 45 -> 250 ft; stories 1-3 -> 1-12 (default
height 9.5 ft + 10 ft per extra story); windows up to 40 x 20 ft, roll-up/dock doors up to 32 x 16 ft; access factor adds
a 0.7 tier to 40 ft and a 0.55 lift/swing-stage tier above it.

**Long walls are swept, not seen at once**
- Wall outlines and openings are clipped to the camera near plane, so a wall you stand next to still draws.
- Detected openings are no longer discarded when you pan away; a miss only counts if the opening should be on screen.
- Candidate chips show the ones nearest the crosshair first (up to 80 tracked per wall).
- Aim readout shows distance and warns past 250 ft.

**Database:** run `016_exterior_large_buildings.sql` (allows up to 12 stories in `exterior_scan_details`; 015 updated for fresh installs).

**Honest limits at this scale:** AR tracking drift is roughly 1% of distance walked (about 4 ft over 409 ft) and a 0.1 degree aim
error at 200 ft is about 0.4 ft. Closing the loop corrects drift; for a single 400 ft wall, mark both ends from the wall line
rather than from far away and treat the confidence report as a guide. Vision opening detection is weakest on distant, small
windows; use Opening (two taps) or Quick add for those. Not yet compiled or field-tested by the author.
