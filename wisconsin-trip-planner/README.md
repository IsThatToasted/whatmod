# Bedroom Connection Builder

Private one-on-one bedroom compatibility builder using Google login + Supabase.

## What changed in this version

- Keeps the existing Supabase config, auth, profiles, sessions, invite links, answers, and realtime sync.
- Moves all questions into `questions.json` so you can edit content without touching app logic.
- Adds collapsible category sections with per-section progress.
- Expands the question set to 340 total prompts.
- Includes two custom placeholder sections you can replace with your own private prompts.
- Uses safer separate Supabase queries instead of embedded joins.

## Files

- `index.html` — app shell
- `styles.css` — dark luxury theme and collapsible sections
- `app.js` — auth, session, realtime, scoring, UI rendering
- `questions.json` — editable question bank
- `config.js` — your Supabase config
- `supabase-schema.sql` — database schema

## Editing questions

Open `questions.json`. Each question has:

```json
{
  "id": "q001_example",
  "category": "Attraction & Chemistry",
  "type": "attraction",
  "text": "Your question text here."
}
```

Keep each `id` unique. The `type` controls the answer buttons. Supported types:

- `attraction`
- `affection`
- `style`
- `desire`
- `exploration`
- `experience`
- `frequency`

## Important

If you replace placeholders with new questions, keep the IDs stable after people start answering, or old saved answers will no longer line up with those prompts.
