# Trivia V6.1 — Practice UX + media reliability

No database migration is required.

## Changes
- Practice's Next Question / Finish Practice button now appears immediately after the submitted answer/result card, before graphs.
- On mobile, users can advance without scrolling through analytics; the closeness and community graphs remain below for optional exploration.
- Question and Library images now normalize old HTTP URLs to HTTPS.
- If a cached Wikimedia thumbnail fails, the client retries through a stable Wikimedia Commons `Special:Redirect/file` URL derived from the stored Commons source page.
- If both image routes fail, the UI shows a clean source-aware placeholder instead of a broken-image icon.
- The Wikidata sync normalizes new cached media URLs to HTTPS.
- Service-worker cache bumped to V6.1.

After deployment, optionally run the **Trivia Question Bank Sync** workflow once to refresh cached question metadata, though existing rows can use the new browser fallback without doing so.
