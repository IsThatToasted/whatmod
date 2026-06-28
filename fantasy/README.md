# Afterglow build

Upload the contents of this folder directly into `https://whatmod.com/fantasy/`.

## Added in this patch

- Rebrands the user-facing app from Fantasy Vault to **Afterglow**.
- Keeps the core **Vault** concept as the **Glow Vault**.
- Adds daily login rewards with a present icon and **Glow Coins**:
  - Day 1: 5
  - Day 2: 10
  - Day 3: 15
  - Day 4: 15
  - Day 5: 20
  - Day 6: 20
  - Day 7: 50
- Keeps all existing matching, profile, messaging, private photo, and admin systems.
- Keeps Admin Studio owner-only for `ra1nonit1@gmail.com`.
- Makes Admin Studio desktop/PC only. Mobile users will not see the Admin tab.
- Adds dynamic Vault prompt support:
  - global answer set
  - yes/no prompts
  - per-prompt custom answer choices
  - short written answers
  - long written answers
  - profile-visible written prompts for matched profiles

## Supabase

Run `supabase-schema.sql` if you have not already run the prior private-photo/message schema. This patch stores Glow Coins inside the existing profile JSON, so no new table is required for daily rewards.

## Safety note

This patch is additive. It does not intentionally remove current features.
