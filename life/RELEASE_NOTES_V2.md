# JustGlance v2.0.0 — Organizer Expansion

This release turns the existing JustGlance daily-life OS into a broader personal organizer while preserving the stable direct-static `/life` GitHub Pages deployment introduced in v1.0.7.

## New organizer surfaces

- Tasks command center with Today, Inbox, Overdue, Next 7 Days, Waiting, Anytime, Completed, and All views.
- Brain-dump Inbox with fast triage.
- Projects with status, priority, target dates, progress, linked tasks, appointments, and thoughts.
- 14-day Planner that combines due work and events.
- Thoughts/notes workspace with task conversion.
- Expanded universal capture for tasks, reminders, appointments, thoughts, and projects.
- Global search now includes projects in addition to items, notes, events, places, spaces, and history.

## Reminder architecture

- Supabase-backed reminder records.
- Native iOS local notification bridge using `UNUserNotificationCenter`.
- Native schedule/cancel commands sent from the web organizer to the SwiftUI/WKWebView shell.

## Data model

Run `supabase/migrations/002_organizer_expansion.sql` after the original v1 schema. It is additive and does not intentionally delete or replace existing v1 user data.

## Deployment

- Keeps `.github/workflows/web-pages.yml` as the one site-wide GitHub Pages publisher.
- Uses repository secrets `JUSTGLANCE_SUPABASE_URL` and `JUSTGLANCE_SUPABASE_ANON_KEY` to generate deployed `/life/config.js`.
- Keeps `.github/workflows/justglance-ios-unsigned.yml` as the separate unsigned IPA builder.
- Fixes the direct-static runtime so it no longer assumes Vite injected `import.meta.env` exists in the browser.
