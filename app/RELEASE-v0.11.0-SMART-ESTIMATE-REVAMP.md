# Aurelium Field v0.11.0 — Build 29

## Smart Estimate architecture revamp

This release replaces the old split between RoomPlan interior scanning and a manual Exterior / Large Surface measuring form with one Smart Scanner entry point and two specialized capture engines.

### Interior Smart Scanner
- Preserves RoomPlan + LiDAR room capture, narration, evidence, 3D USDZ and RoomPlan JSON.
- Preserves native RoomPlan camera framing rather than applying a digital zoom/crop that could imply different measurement geometry.
- Adds a Teach Scanner review section for correcting RoomPlan door/window counts before final estimate creation.
- Stores raw prediction vs confirmed count as labeled scanner-learning samples.

### Exterior Smart Scanner
- New ARKit world-tracking capture using vertical/horizontal plane detection.
- Enables LiDAR scene reconstruction (`meshWithClassification` when supported).
- Detects rectangular visual opening candidates with Vision while scanning.
- User can confirm a candidate as Window or Door; Aurelium raycasts candidate corners against vertical geometry to estimate physical width/height.
- Teach Scanner can add missed Window, Door, Opening, or Roof Slope directly in AR by tapping measured points.
- Exterior wall planes are collected automatically and converted to paintable elevation quantities.
- Review calculates gross wall area, opening deductions, paintable area, counts, and labor lines.
- The previous manual exterior segment form is no longer in the active Smart Estimate flow.

### Scanner learning foundation
- New `scanner_learning_samples` table stores labeled corrections instead of pretending the client is retraining itself immediately.
- Captures interior prediction/count corrections and exterior taught/confirmed geometry.
- Data is organization isolated with RLS and is intended to support future trained model evaluation/versioning.

## Blueprint Estimate

A new Blueprint Estimate button is nested inside Smart Estimate.

Native iOS can import PDF or image plans and:
- render PDF sheets locally;
- run Vision text recognition;
- identify likely drawing scales;
- identify room/space labels;
- identify paint/finish codes;
- identify explicit SF quantities;
- derive ceiling area from printed room dimensions;
- derive gross wall area only when a supported wall/ceiling height is found;
- inspect door/window schedule-like rows;
- flag missing scale, height, ambiguous finish information, unsupported quantities, and opening deductions;
- keep proposal generation disabled while blocking issues remain;
- create a proposal draft from supported quantities only after verification passes.

Blueprint analysis records and per-sheet analysis are persisted to Supabase and surfaced on the web Smart Estimate workspace.

### Important scope
This release does **not** claim that OCR alone can infer every dimension from arbitrary construction drawings. When the plan does not provide enough supported data, Aurelium intentionally creates blocking review issues instead of inventing measurements. Vector/geometry extraction and model-assisted plan interpretation can build on the schema introduced here.

## Database
Apply only:

`011_smart_scanner_blueprint_estimates.sql`

after migration 010. Do not rerun migration history.

## Stability
- Frozen authentication/workspace files were not modified.
- Existing Field, Payroll, Chat, Projects, time clock and RoomPlan persistence remain in place.
- Version: 0.11.0
- Build: 29
