# JustGlance v2.4.3 — Quiet browser capture + smarter Now shopping cadence

## Extension
- Add to JustGlance v1.3.0 no longer parses product pages during ordinary browsing.
- Retailer DOM/JSON-LD extraction starts only after the user explicitly opens Add to JustGlance.
- Best-effort parser/runtime failures are kept out of the retailer page console where possible.
- Retailer-specific parsers remain available on demand, including Amazon, Walmart, Target, Etsy, and Best Buy.

## Now
- Far-future shopping items no longer appear in Useful right now just because they are recent, quick, or newly captured.
- Normal-priority shopping reminders surface exactly 7 days before the due date, the day before, and the day of.
- High-priority shopping items surface daily during the final 7 days with a days-remaining countdown and remain visible if overdue.
- Shopping items without a due date stay in Shopping unless Errands mode is selected or the user is near the matching place.
- The generic Shopping count card was removed from Now so Shopping only appears there when context makes it useful.

No database migration is required. The shared `web-pages.yml` deployment remains unchanged.
