# Connection Quest Engine v4

This is a redesigned, data-driven gamified intimacy compatibility app.

## What changed

- Web game rebuilt around areas/worlds, challenge cards, XP, levels, secret gates, and Bedroom Builder.
- `game-content.json` is the source of truth for areas, unlock rules, challenges, questions, secrets, achievements, and settings.
- Dark dashboard-style Windows editor: `admin_editor.py`.
- Areas, challenges, questions, secrets, achievements, global settings, and raw JSON are editable.
- Double-click table rows in the editor to edit.
- Replacement markers such as `CUSTOM_REPLACE_EXPLICIT_ITEM` are intentionally labeled for you to replace with your own adult-specific content.
- Storage is ID-based and text-capped to keep Supabase usage low.

## Test locally

Open `index.html` in a browser for local test mode.

For Supabase login:

1. Copy `config.example.js` to `config.js`.
2. Fill in your Supabase URL and anon key.
3. Run `supabase-schema.sql` in Supabase SQL editor.
4. Enable Google auth in Supabase.

## Run the desktop editor

```bash
python admin_editor.py
```

The editor loads `game-content.json` in the same folder.

## Unlock logic

Each area has:

- `unlock.level`
- `unlock.xp`
- `unlock.secrets`
- `unlock.completedAreas`

An area unlocks only when all requirements are satisfied.

## Gating

Users can skip secrets and view the main app, but connection-related actions and Bedroom Builder-style private compatibility actions can require a minimum number of secrets.

The global setting is:

```json
"starterSecretMinimum": 4
```

## Safety/content note

The packaged content stays structured and compatibility-focused. Items you likely want to make more direct are labeled with `CUSTOM_REPLACE...` so you can replace them in your own editor before launch.
