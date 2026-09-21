# WhatMod Trivia V23 — Board Battle

V23 adds a second fully synchronized multiplayer format without replacing Daily, Practice, Quick Match, or the existing Party estimation game.

## Install

1. Deploy the V23 frontend files under `/trivia`.
2. Run `supabase/migrations/022_board_battle_mode.sql` once in the Supabase SQL Editor.
3. Refresh `/trivia/` after deployment so the V23 service-worker cache is installed.

The migration is additive and preserves existing questions, profiles, XP, games, library sessions, votes, media, and admin data.

## Board Battle rules

- 2–10 human players per lobby.
- Host chooses exactly six categories.
- Each selected category must have at least five active questions.
- 30 board clues: five per category at `$400`, `$800`, `$1200`, `$1600`, and `$2000`.
- Lower rows prefer easier questions; higher-value rows prefer harder questions, with safe fallback when a category has an uneven difficulty mix.
- A random active player begins with board control.
- The player with control selects the next clue.
- Normal clues open a 12-second server-timestamped buzz window.
- First server-accepted buzz owns the answer attempt.
- Correct answers add the clue value and give that player board control.
- Incorrect answers subtract the clue value, lock that player out of the current clue, and reopen buzzing to the remaining players.
- The host can manually reveal/close a stuck clue.
- Two higher-row cells are hidden `Double Down` cells. The selecting player gets an exclusive wager up to the greater of `$2,000` or their current score, then answers without an open buzzer.
- After all 30 cells clear, the game enters a Final Wager phase. The final category is shown before wagering; the clue remains hidden until wagers lock or the timer expires.
- Final answers are simultaneous and scored `+wager` / `-wager`.
- Text answers may optionally use classic quiz-board phrasing such as `What is ...?` or `Who is ...?`; the phrasing is not required.

## Timers and disconnect safety

- Buzz window: 12 seconds.
- Normal answer timer: host-selectable 10–30 seconds.
- Double Down wager: 30 seconds; if the controlling player disappears, the game automatically continues with a zero wager rather than hanging the room.
- Reveal: 4 seconds before returning to the board.
- Final wager: 30 seconds.
- Final clue: 30 seconds.

All timer transitions are validated in Supabase RPCs. Clients use server timestamps and any participant can call the idempotent clock-sync RPC, so one disconnected host does not freeze an active board.

## Joining and replay

- Existing lobby codes and invite links work with Board Battle.
- Players who join after a board has started enter as spectators for that run.
- On return to the same lobby after the result screen, spectators become active for the next board.
- Finished Board Battle games reuse the existing Library snapshot trigger. The 30 board questions plus the Final clue are saved as ordered question IDs rather than duplicated question content.
- V23 raises the replay-practice question-count constraint to 50 so a 31-question Board Battle replay can open correctly.

## Existing systems reused

Board Battle intentionally uses the existing:

- Google/Supabase authentication;
- profiles, XP, games played, and wins;
- `games` / `game_players` room shell;
- lobby code joining;
- Realtime game-row updates and fallback polling;
- room lifecycle heartbeat/cleanup;
- current question bank, categories, media, explanations, and source metadata;
- Replay Library snapshots.

No bot matchmaking is added to Board Battle in V23. This first release is deliberately a 2–10 human lobby mode.

## Presentation

The mode is presented as **Board Battle** and implements the familiar quiz-board mechanics requested for the game. The package does not include another game show's logo, branded visual assets, theme music, or recordings.
