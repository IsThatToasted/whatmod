# Wildform iOS Prototype

**Walk. Adapt. Evolve.**

This is a native SwiftUI proof-of-concept for the Wildform location RPG. It is designed to live at `whatmod/wildform` while the GitHub Actions workflow remains at the repository root under `.github/workflows/wildform-ios.yml`.

## Included in this demo

- Native SwiftUI iPhone/iPad app
- CoreMotion step counting
- Persistent Bio Energy, XP, levels, steps, battles, inventory and affinities
- CoreLocation permission handling
- MapKit exploration map with player position
- Local procedural enemy spawning around the player's current location
- Simulator-friendly demo location
- Fast playable combat with attack, dodge and Surge ability
- XP/resource/affinity rewards
- Three first evolution branches
- Local save persistence via `UserDefaults`
- No third-party SDKs, map keys or backend required
- GitHub Actions unsigned IPA build workflow

## Repository placement

Copy the folders from this ZIP into the root of your existing `whatmod` repo so the result is:

```text
whatmod/
├─ .github/
│  └─ workflows/
│     └─ wildform-ios.yml
└─ wildform/
   ├─ project.yml
   ├─ README.md
   └─ Sources/
```

## Build on GitHub

1. Commit the files to your repository.
2. Open **Actions** in GitHub.
3. Select **Build Wildform iOS**.
4. Click **Run workflow**.
5. When the job finishes, download the `Wildform-unsigned-IPA` artifact.
6. The resulting IPA is unsigned and intended for your normal sideload/signing workflow.

The workflow also runs automatically when files under `wildform/**` or the Wildform workflow itself change on `main`.

## Run locally with Xcode

This project uses XcodeGen so the `.xcodeproj` does not need to be committed.

```bash
brew install xcodegen
cd wildform
xcodegen generate
open Wildform.xcodeproj
```

Select your development team if installing directly from Xcode.

## Permissions

The app requests:

- **Location While Using the App** for nearby encounters.
- **Motion & Fitness** for step counting.

The prototype does not use continuous background location. That should be designed deliberately later around battery usage, App Store policy, privacy and gameplay requirements.

## Demo flow

1. Open **Home** and either walk with a physical iPhone or use **Simulate 1,000 steps**.
2. Open **Explore** and grant location permission. On Simulator, press **Demo Location**.
3. Press **Scan Area** to generate nearby lifeforms.
4. Tap an encounter marker and battle it.
5. Wins award XP, resources and affinity.
6. Reach level 3 and at least 5 affinity in Ember, Flora or Storm to test first evolution.

## Next production milestones

The architecture is intentionally small for this first proof-of-concept. The next phase should add Supabase authentication/cloud saves, server-authoritative encounter generation, anti-spoofing protections, real geospatial cells/biomes, world-state events, mutation slots, Bestiary/Research, crafting, Den upgrades, friend/Pack systems and production art/audio.
