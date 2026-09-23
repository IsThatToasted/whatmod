# JustGlance v2.2.1 — Link Preservation + Edit Modal Fix

- Actionable captures that contain URLs stay actionable (shopping/task/etc.) instead of being reduced to passive link captures.
- Captured URLs remain in the original source text and shopping URLs populate rich shopping metadata when available.
- Every item card can recover and show an **Open link** action from shopping metadata, source text, or notes, including older items created before this fix.
- Edit Item now exposes a universal **Reference / product link** field.
- The edit modal now uses a fixed header + independently scrolling body and dynamic viewport sizing, preventing the bottom of long forms from becoming inaccessible on mobile/short screens.
- `next week` now resolves to the coming Monday in Smart Intake.
- No database migration is required.
- Shared `web-pages.yml` deployment is unchanged.
