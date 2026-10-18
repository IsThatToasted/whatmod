# Aurelium Field v0.13.0 — Build 32
## Admin Estimate Approval & Final Proposal Pipeline

This release closes the post-walkthrough workflow gap. Completing a project walkthrough no longer only archives scans: it creates a durable, revisioned Estimate Review Packet for Admin review on native iOS and the web admin workspace.

### New Admin > Estimates workspace
- Submitted and in-review estimates with badges/counts.
- Approved estimates waiting for customer-document finalization.
- Permanent finalized/rejected history.
- Full submitted walkthrough snapshot: room/elevation names, detected counts, measurement state, wall/opening quantities, current scope lines, production labor, notes, and evidence metadata.
- Review states: Submitted → In Review → Approved / Rejected → Finalized.
- Internal admin review notes and rejection/revision reason.
- Customer proposal editor for title, customer name/email, scope summary, customer notes, terms/exclusions, subtotal and tax.
- Customer total calculation.
- Native iOS PDF generation/share for finalized proposals.
- Web Print / Save PDF customer proposal output.

### Walkthrough submission behavior
- “Complete Project Walkthrough” is now presented as “Submit for Estimate Review.”
- Submission still locks/archives the completed walkthrough set, but also creates a durable database snapshot for Admin review.
- Current editable `scope_lines` are the primary final takeoff source, so post-scan changes to doors/windows/trim/ceilings, quantities, production rates, and labor are reflected in the submitted Admin packet.
- Legacy line items are used only as a fallback for older walkthroughs without editable scope snapshots.

### Existing archived walkthrough recovery
Migration 013 backfills projects that were completed before this release. Existing archived walkthrough projects with no review packet are converted into Revision 1 submitted Estimate Review Packets without changing or deleting their source scans.

### Database
Apply only:
`013_admin_estimate_approval.sql`

after migrations 001–012. Do not rerun prior migrations.

New table:
- `estimate_review_packets`

New/replaced RPCs:
- `complete_project_walkthrough(uuid)` — same client signature, now also creates/updates an Estimate Review Packet.
- `admin_set_estimate_review_state(uuid,text,text)`
- `admin_finalize_estimate_packet(...)`

### Security
- Organization members can read their organization's review packets.
- Only owners/admins can modify review/approval/final proposal records.
- Existing auth and workspace bootstrap files remain byte-identical to v0.12.1.

### Validation
- All native Swift files parse successfully.
- Explicit Xcode source manifest paths exist, including the new isolated `EstimateAdminService.swift`.
- Workflow YAML, project YAML, plist and runtime JSON validate.
- Changed Admin TypeScript passes syntax transpilation.
- Frozen native/web authentication files byte-match v0.12.1.
- No retired auth sources or dangerous Swift traps were introduced.
- Full local Vite dependency/type build is not available in this container because project npm dependencies are not installed; GitHub Actions remains the authoritative full web build.
