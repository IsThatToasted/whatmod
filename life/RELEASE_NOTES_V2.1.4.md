# JustGlance v2.1.4 — Smart Capture + Focus Modes

- Treats explicit `next <weekday>` as the weekday in the following week instead of the nearest occurrence.
- Recognizes `Doctors`, `Doctor's`, physician/medical/clinic phrasing as appointment context.
- Smart Capture now fills the visible Date and Time inputs from parsed text while preserving manual overrides.
- Keeps parsed location attached to appointments even when it is not a saved Place.
- Makes the "What do you feel like doing?" controls visibly functional: selecting a mode re-ranks/focuses the Now feed and explains what that mode is prioritizing.
- No database migration and no workflow changes. Deployment remains the shared `.github/workflows/web-pages.yml`.
