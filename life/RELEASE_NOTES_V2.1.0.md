# JustGlance v2.1.0 — Shared Spaces + Smart Intake

This release is an additive upgrade over v2.0.1. It keeps the existing `/life` static deployment model and does not add or require a separate JustGlance web workflow.

## Supabase migration

Run **`supabase/migrations/003_shared_spaces_smart_intake.sql`** after migrations 001 and 002.

The migration is designed to preserve existing data. Existing shared-space members receive the same full category access they had before; new permission controls can then narrow access per member.

## Added

- More reliable secure invite-link RPC (`create_space_invite_v2`) with seven-day links, optional email binding, member/admin role, permission payloads, and protection against delegated inviters granting access they do not hold themselves.
- Clear account/demo-mode status inside Spaces so it is obvious when a session cannot create real share links.
- Shared-space member permissions for Shopping, Tasks, Calendar, Thoughts/Files, Projects, and invite creation.
- Member permission editor for owners/admins.
- Named shopping lists inside each shared space.
- Smart Intake capture for text, links, files, images, `.ics` calendar exports, and common Outlook/calendar `.csv` exports.
- Local smart parsing that recognizes appointments, dates, times, locations, links, reminders, shopping, tasks, and thoughts.
- High-confidence appointment text creates an event directly from Capture; missing time/date can still be filled manually before saving.
- Private Supabase Storage bucket for captured files/images (15 MB per file).
- Smart Capture Inbox and universal search coverage for captured links/files.
- Calendar import from Outlook, Google Calendar, Apple Calendar, and other calendar apps through `.ics`, plus common Outlook/calendar `.csv` formats; external IDs are retained when available for duplicate protection.
- Calendar provider interface expanded for future OAuth-backed Google/Microsoft provider implementations.

## Deployment

Continue deploying `/life` through the repository's existing shared `web-pages.yml` workflow. `justglance-web-build.yml` is not needed by this release.
