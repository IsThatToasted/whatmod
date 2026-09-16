# Trivia V16 — Relatable Categories + Topic Discovery

V16 adds dynamic categories to the game UI and upgrades the Windows Local Content Studio with:

- Brainrot, General Gaming Knowledge, Internet Culture, Pop Culture, Movies & TV, Music, Food & Brands, and General Knowledge category support.
- A Mainstream / Balanced / Deep Cuts familiarity gate for normal Wikidata generators.
- Topic Discovery: enter one or more search phrases, preview usable question candidates, choose how many to acquire, and save the topic as a reusable local pack.
- Saved custom topic packs keep their own local search offsets/indexes.
- Numeric fact generation plus identification multiple-choice generation from sourced Wikidata descriptions.
- Active categories are discovered from Supabase so imported custom categories automatically appear in Practice and custom-lobby category selectors.

Run migration `016_dynamic_categories_topic_discovery.sql` after deploying the V16 frontend.
