# Connection Quest

A gamified two-person compatibility app that keeps the original Bedroom Builder concept intact as a hidden advanced unlock.

## What changed

- Quest map with unlockable areas
- XP and level progression
- Challenge cards instead of plain survey rows
- Secret Vault with level-based reveals
- Hidden Bedroom Builder button unlocked at Level 10
- Supabase login, sessions, invite links, answers, realtime sync retained
- Storage-efficient design: most game content lives in `game-content.json`; Supabase only stores profiles, sessions, compact answers, XP, and short secrets
- Windows admin editor for editing areas, challenge names, answers, secret prompts, XP values, and unlock levels

## Files

- `index.html` - app shell
- `styles.css` - animated premium UI
- `app.js` - Supabase game logic
- `game-content.json` - editable game data
- `supabase-schema.sql` - database schema and RLS policies
- `config.js` - your existing Supabase connection
- `admin_editor/connection_quest_editor.py` - Windows/Python content editor
- `admin_editor/run_editor.bat` - double-click launcher

## Setup

1. Upload these files to your GitHub Pages project or run locally with a simple server.
2. In Supabase SQL Editor, run `supabase-schema.sql`.
3. Confirm Google login redirect URLs include your local and hosted URLs.
4. Edit `game-content.json` directly or launch the editor:

```bat
admin_editor\run_editor.bat
```

## Local test server

From the project folder:

```bash
python -m http.server 5173
```

Open:

```text
http://localhost:5173
```

## Storage efficiency notes

The app deliberately avoids storing full challenge text, area names, animation state, or long unlock logs in Supabase. Those remain in `game-content.json`. Supabase stores only:

- one profile row per user
- one session row per connection
- one answer row per answered challenge
- one compact XP/player state row per user per session
- short secret answers only

This keeps database growth predictable and cheap.

## Editing the game

Use the Windows admin editor to change:

- area names
- area unlock levels
- area descriptions
- challenge titles
- challenge prompts
- answer choices
- XP rewards
- secret prompts
- secret unlock levels

After saving, redeploy or refresh the browser. The app fetches `game-content.json` without cache during development.
