# JustGlance v2.1.0 — Shared Spaces + Smart Intake

**Your life, at a glance.**

JustGlance is the personal daily operating system hosted at `https://whatmod.com/life/`. v2 keeps the stable v1.0.7 direct-static GitHub Pages architecture and expands the product into a much broader personal organizer without turning the homepage into a traditional productivity dashboard.

## What v2.1 adds

- **Universal Capture** — capture a task, reminder, shopping item, call, errand, chore, idea, appointment, thought/note, or whole project from the same sheet.
- **Task Command Center** — smart views for Today, Inbox, Overdue, Next 7 Days, Waiting, Anytime, Completed, and All.
- **Inbox / Brain Dump** — anything captured without enough structure can sit safely in Inbox until it is triaged.
- **Projects** — projects have an outcome, target date, priority, progress, connected next actions, appointments, and notes.
- **Planner** — combines due tasks and appointments into one agenda, with a 14-day fast date strip.
- **Reminder records** — reminders live in Supabase instead of being just another task label.
- **iOS local reminders** — the WKWebView wrapper exposes a secure message bridge that schedules/cancels native local notifications with `UNUserNotificationCenter`.
- **Thoughts** — keep ideas and reference notes without forcing a due date; convert a thought into a task when it becomes actionable.
- **Task organization metadata** — project, parent task, start/scheduled/defer dates, energy, waiting-for, inbox state, focus pin, and sort order.
- **Keyboard speed** — `C` opens universal capture and `Ctrl/Cmd + K` opens search when focus is not inside a form field.
- **Responsive organization navigation** — desktop exposes the full organizer; mobile keeps a simple Now / Tasks / Capture / Plan / More dock.

The original NOW relevance engine, organizer, projects, Later, shared Spaces, places, Daily Reset, Morning Brief, offline queue, Supabase auth/RLS/realtime, search, themes, fixed desktop navigation, and responsive design are preserved.

New in v2.1: secure invite links with category permissions, named shared shopping lists, Smart Intake for links/files/images, stronger appointment parsing, a capture inbox, private capture storage, and `.ics` calendar import for Outlook/Google/Apple exports.

## Repository placement

Copy the package into the root of the existing WhatMod repository while preserving paths:

```text
whatmod/
├── .github/
│   └── workflows/
│       ├── web-pages.yml
│       └── justglance-ios-unsigned.yml
└── life/
    ├── index.html
    ├── app.js
    ├── config.js
    ├── runtime/
    ├── styles.css
    ├── source/
    ├── supabase/
    └── ios/
```

Do not create a second GitHub Pages deployment. `web-pages.yml` remains the single site-wide Pages workflow and continues to preserve unrelated WhatMod subdirectories.

## Supabase GitHub secrets

The existing Pages workflow reads exactly these repository secrets:

- `JUSTGLANCE_SUPABASE_URL`
- `JUSTGLANCE_SUPABASE_ANON_KEY`

They are injected into the deployed `_site/life/config.js`. The anon/publishable key is expected to be client-visible; RLS is the security boundary. **Never use the Supabase service-role key in the web app.**

If the values are missing, the committed `config.js` contains blanks and JustGlance can fall back to its local/demo behavior instead of exposing a secret.

## Database setup / upgrade

Run the migrations in Supabase SQL Editor in order:

```text
life/supabase/migrations/001_initial_schema.sql
life/supabase/migrations/002_organizer_expansion.sql
life/supabase/migrations/003_shared_spaces_smart_intake.sql
```

For an existing v2.0.x database, run only `003_shared_spaces_smart_intake.sql`. It is additive and keeps existing tasks, projects, events, notes, spaces, members, and shopping rows. Existing members keep full category access until an owner/admin changes it.

### v2.1 database additions

`space_members` and `invites` gain per-category permissions.

`shopping_lists` adds named lists within a shared space; existing unassigned shopping items remain available in the General list.

`captures` stores Smart Intake records for links, files, images, and unprocessed material. A private `justglance-captures` Storage bucket preserves uploaded files.

`calendar_imports` records import runs, while `events.provider` + `events.external_id` are used to avoid duplicate imported events.

RLS now enforces category visibility for shared shopping, tasks, calendar events, notes/files, and projects.

## Web deployment

The public app remains browser-ready under `/life`. The site-wide workflow:

1. builds `/app` if that separate project exists,
2. validates the committed JustGlance runtime,
3. assembles one `_site` artifact for all WhatMod apps,
4. injects the JustGlance Supabase URL/anon key,
5. deploys GitHub Pages once.

No additional web workflow is required.

## React / TypeScript development source

The maintainable source remains under `life/source/src`. The committed `life/runtime` directory is the browser-ready ESM form used by the direct-static hosting strategy that fixed the earlier Pages startup issues.

The normal Vite project is retained in `life/source` for development/testing:

```bash
cd life/source
npm install
npm run dev
npm run typecheck
npm run test
npm run build
```

## iOS

`life/ios/JustGlance` is a SwiftUI + WKWebView wrapper pointed at `https://whatmod.com/life/`.

The existing `.github/workflows/justglance-ios-unsigned.yml` builds an unsigned IPA for Sideloadly. No second iOS workflow is needed.

v2 adds the `justglanceNative` WKWebView message bridge. When the web app creates a reminder in the iOS wrapper, the bridge requests notification permission and schedules a native local notification. Reminder cancellation removes pending/delivered notifications with the same reminder ID.

## Release checklist

1. Copy this package over the existing repo paths.
2. If v2.0.x is already installed, run only `003_shared_spaces_smart_intake.sql` in the existing JustGlance Supabase project.
3. Confirm GitHub repository secrets `JUSTGLANCE_SUPABASE_URL` and `JUSTGLANCE_SUPABASE_ANON_KEY` exist.
4. Push to `main`; the existing `web-pages.yml` deploys the web app.
5. Open `https://whatmod.com/life/`, sign in, create an invite link in a shared Space, create a named shopping list, Smart Capture an appointment, and import a small `.ics` file.
6. Run **JustGlance iOS Unsigned IPA** manually (or change an iOS file to trigger it), install the artifact with Sideloadly, and accept notification permission when the first native reminder is scheduled.

## Security notes

- Browser configuration uses only the Supabase public anon/publishable key.
- Row Level Security remains enabled on user and shared-space data.
- `projects` inherit the owner/shared-space access model.
- `reminders` are owner-only.
- The native bridge accepts only a small command set: schedule reminder, cancel reminder, and request notification permission.
- No service-role key or privileged backend credential is included in the package.


## Repository deployment rule

The web app at `/life` is deployed by the repository-wide `web-pages.yml` workflow together with the other WhatMod subdirectory apps. Do not create or re-enable a separate `justglance-web-build.yml` for web publishing.

### v2.1 import support

Smart Intake and Planner accept `.ics` exports from Outlook, Google Calendar, Apple Calendar and other tools, plus common Outlook/calendar CSV exports. Live OAuth provider adapters remain an extension point; file import works now without OAuth.
