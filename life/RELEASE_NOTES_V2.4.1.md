# JustGlance v2.4.1 — Browser pairing + people/access directory

## Chrome extension pairing

- Updated **Add to JustGlance** to extension v1.1.0.
- Added a direct page-to-extension bridge on `whatmod.com/life/` so Settings can pair the current browser without making the extension rediscover production configuration.
- The app passes the one-time browser token plus the already-loaded public Supabase URL and publishable/anon key to the extension. No service-role credentials are used.
- Settings now reports whether the extension is detected and which version is active.
- Existing browser integration rows are separated into **Connected browsers** and **Unused pairing codes**. Unused codes can be revoked in bulk.
- Manual code pairing remains available as a fallback.

## Spaces / sharing

- Spaces now lead with a global **People & access** directory.
- A collaborator appears once even when they belong to several Spaces.
- Access for that person can be reviewed and edited across every Space the current user administers.
- Per-Space category permissions remain the source of truth: Shopping, Tasks, Calendar, Thoughts & files, Projects, and inviting members.
- Added a global view of pending invitations created by the signed-in user with revoke controls.
- The normal Space cards remain available below the people directory for entering a specific shared context.

## Memory

- Replaced the old Memory search field with the same rounded search-box pattern used by Contacts / universal Search.

## Deployment

- No database migration is required for v2.4.1.
- No GitHub workflow changes are included. `/life` continues to deploy through the shared `web-pages.yml` workflow.
