# V6 Upgrade — Practice graphs, Community Answers, Replay Library, media, and open question sync

For an existing V5 project:

1. Deploy the V6 `/trivia` files.
2. Run `supabase/migrations/006_library_community_media.sql` once in Supabase SQL Editor.
3. In GitHub repository secrets, add:
   - `TRIVIA_SUPABASE_URL`
   - `TRIVIA_SUPABASE_SERVICE_ROLE_KEY`
4. Manually run the **Trivia Question Bank Sync** workflow once. It then also runs weekly.

Never put the service-role key in `trivia/config.js` or any browser file.

## Practice result graphs

Numeric Practice answers now show:

- a primary logarithmic closeness graph for **You vs Correct Answer**;
- a collapsible **Community Answers** histogram beneath it;
- the community visualization excludes the current answer client-side so the label really means “everyone else” when possible.

Community analytics use one 41-bin aggregate row per question instead of one analytics row per player. The aggregate therefore stays approximately constant-size as a question receives more answers.

## Replay Library

Completed Practice sessions and finished Party games automatically create a public replay snapshot. A snapshot stores the ordered `uuid[]` of questions plus compact metadata, rather than copying question text, answers, explanations, or images.

If the identical ordered question set is generated again, the existing snapshot is reused and `times_generated` is incremented.

Library replays launch as Practice sessions and award no XP.

`prune_ephemeral_practice(30)` can remove old completed Practice internals after the durable Library snapshot exists. The scheduled question-sync workflow calls this cleanup after successful hydration.

## Question scale + images

`trivia/tools/wikidata-question-sync.mjs` progressively hydrates the local question cache from Wikidata. It currently includes templates for release years, inception/birth years, mountain elevations, and building heights. The template system is intentionally extendable rather than requiring millions of copied rows up front.

When a Wikidata entity has a Commons image, the importer requests Wikimedia Commons metadata and stores only:

- thumbnail URL;
- source page URL;
- attribution;
- license name;
- license URL.

No image bytes are copied into Supabase Storage.

Imported questions are deduplicated by `canonical_key`.
