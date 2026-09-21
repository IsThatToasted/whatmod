# Wildform iOS — Vertical Slice v0.2.0

**Wildform** is a location-driven creature RPG where the player *is* the evolving creature.

This build expands the original functional demo into an animated vertical slice while preserving the native SwiftUI/MapKit/CoreMotion architecture and unsigned GitHub Actions IPA workflow.

## v0.2 highlights

- Animated, layered Wildform UI with a living background and game-oriented HUD
- Procedural creature genome system
  - body variant
  - ear variant
  - horn variant
  - eye variant
  - tail variant
  - natural marking variant
- Species-specific palettes for Origin, Emberling, Thornling, Stormling, Tideling, Shadeling and Fangling
- Layered cosmetic system independent of creature biology
- Wild Shop with earnable **Lumens**
- Cosmetic purchasing, ownership and equipping
- Head, marking, aura and trail cosmetic slots
- Animated cosmetic effects
- Procedurally synthesized audio cues using AVFoundation — no audio assets required
- Haptics for combat, scans, purchases and evolution
- Sound toggle
- Expanded exploration UI
- Common / Uncommon / Rare / Aberrant wild encounters
- Procedurally seeded enemy appearances
- Expanded animated battle presentation
- Rarity-scaled battle rewards
- Mutation Dust drops for high-rarity encounters
- Six first evolution branches
- Adaptation meters and genome presentation
- Expanded inventory and wardrobe overview
- Save migration from v0.1.1 so existing local demo progress can decode into the new PlayerState

## Economy philosophy

The current shop uses only **Lumens**, earned through movement and encounters. Cosmetics are intentionally isolated from combat stats. The model is ready to grow into achievement rewards, seasonal cosmetics, rare drops and an optional premium currency later without making paid cosmetics affect battle power.

## Project location

Place this folder at:

`whatmod/wildform`

The workflow belongs at:

`whatmod/.github/workflows/wildform-ios.yml`

## Build

Push a change under `wildform/**` or manually run **Build Wildform iOS** in GitHub Actions. The workflow generates the Xcode project with XcodeGen, builds an unsigned iPhone Release app, packages `Wildform-unsigned.ipa`, and uploads it as an artifact.

## Development controls

The Home screen includes **Simulate 1,000 steps** for testing progression without real movement. Explore includes a **Demo Location** option when location is unavailable.

## Next production systems

The current architecture is prepared to expand into biome/world cells, deterministic server-side encounter generation, bestiary research, ability loadouts, mutation slots, Den progression, crafting, quests/Instincts, Packs/friends, cloud accounts and saves, seasonal world events, StoreKit cosmetics, anti-cheat location validation and background walking rewards.
