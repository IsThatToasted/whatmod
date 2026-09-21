# Trivia V7 — Media Resolver V2 + Trivia Admin

V7 adds an automatic, license-aware media pipeline and a separate admin dashboard at:

`https://whatmod.com/triviaadmin/`

## Upgrade an existing V6.2 install

1. Extract the V7 drop-in package over the repository root.
2. Run `trivia/supabase/migrations/007_media_resolver_admin.sql` in Supabase SQL Editor.
3. In Supabase Authentication > URL Configuration, add `https://whatmod.com/triviaadmin/` to Redirect URLs.
4. Confirm GitHub Actions secrets still exist:
   - `TRIVIA_SUPABASE_URL`
   - `TRIVIA_SUPABASE_SERVICE_ROLE_KEY`
5. Push to GitHub.
6. Run **Trivia Media Resolver** once from GitHub Actions.

The scheduled resolver also runs automatically each day, and Question Bank Sync now resolves media after importing new questions.

## Automatic media behavior

- No admin approval is required for normal display.
- The resolver searches Wikimedia Commons and Openverse, probes image URLs, stores compact candidate metadata, and selects the highest-ranked auto-eligible candidate.
- Automatic Openverse selection is conservative: public-domain/CC0/CC BY/CC BY-SA licenses are eligible; other licenses are not automatically selected.
- Admin-approved images become locked so future resolver jobs never replace them.
- Rejecting a candidate is persistent; scheduled resolver jobs will not immediately re-add it.

## /triviaadmin

The admin dashboard uses the same Supabase project and Google Auth as Trivia. Only `profiles.is_admin = true` accounts can use the admin RPCs.

From the dashboard you can:

- filter missing/auto/approved/locked questions;
- preview the currently live image;
- inspect all saved candidates and attribution/license metadata;
- approve + lock the current image;
- select another resolver candidate;
- permanently reject a bad candidate;
- change the media search subject;
- search Wikimedia Commons and Openverse live;
- use a live search result immediately or approve + lock it;
- enter a manual direct image/source/creator/license override;
- intentionally lock a question to have no image.

## Storage model

V7 stores candidate metadata and URLs, not duplicate copies of every source image. This keeps Supabase storage/database growth small while still giving each question multiple recoverable choices.

The permanent question row holds only the selected media fields. `question_media_candidates` contains lightweight alternative metadata.
