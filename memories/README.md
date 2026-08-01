# Memories — WhatMod

A private, animated memory archive for the web and iOS.

**Web URL:** `https://whatmod.com/memories/`  
**Supabase project:** `https://gapqvyfoxxyoymtogvbt.supabase.co`  
**iOS bundle ID:** `com.whatmod.memories`

## Included

- Responsive GitHub Pages web app with no web build step
- Email/password, magic-link, and Google authentication through Supabase
- Private user archives protected by Row Level Security
- Memory and fragment capture with approximate dates
- Photo, video, audio, and PDF uploads to a private Storage bucket
- People, places, emotions, sensory clues, tags, and life chapters
- Timeline, story pathways, fragment exploration, and animated constellation view
- Favorites, search, local demo mode, data export, and JSON import
- Realtime refresh across signed-in devices
- Installable PWA manifest and service worker
- SwiftUI/WKWebView iOS wrapper
- GitHub Actions workflow that builds an unsigned IPA for Sideloadly

## 1. Upload to GitHub

Copy the release package into the **root** of the existing `IsThatToasted/whatmod` repository while preserving paths:

```text
whatmod/
├── .github/
│   └── workflows/
│       └── memories-ios-ipa.yml
└── memories/
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── schema.sql
    ├── manifest.webmanifest
    ├── sw.js
    ├── icons...
    └── ios/
        └── Memories/
```

Do **not** replace the existing `.github/workflows/ios-ipa.yml`; the included `memories-ios-ipa.yml` is a separate workflow.

Once committed to `main`, the existing GitHub Pages site should publish the folder at:

```text
https://whatmod.com/memories/
```

## 2. Create the Supabase database

1. Open the Supabase project.
2. Go to **SQL Editor**.
3. Open `memories/schema.sql` from this package.
4. Paste the entire file and choose **Run**.
5. Confirm the final query completes without errors.

The schema is designed to be rerunnable. It creates:

- `memory_profiles`
- `memories`
- `memory_media`
- `memory_people`
- `memory_person_links`
- `memory_places`
- `memory_place_links`
- `memory_life_chapters`
- `memory_pathways`
- `memory_pathway_items`
- `memory_links`
- private `memory-media` Storage bucket
- owner-only RLS policies
- realtime publication entries

The publishable key in `app.js` is intentionally public client configuration. Security depends on the included Row Level Security and Storage policies, not on hiding that key.

## 3. Configure Supabase authentication

In **Authentication → URL Configuration** set:

```text
Site URL:
https://whatmod.com/memories/
```

Add these redirect URLs:

```text
https://whatmod.com/memories/
https://whatmod.com/memories
https://whatmod.com/memories/**
```

Enable the desired providers in **Authentication → Providers**:

- Email provider for password accounts and magic links
- Google provider for Google sign-in

For Google, the authorized callback URL is shown by Supabase in the provider settings. Add that callback to the Google Cloud OAuth client exactly as Supabase displays it.

## 4. Test the web app

1. Open `https://whatmod.com/memories/`.
2. Use **Explore the demo** first. Demo changes stay in that browser only.
3. Create a real account.
4. Add a memory with a photo.
5. Refresh and verify it returns.
6. Sign in on a second browser and verify the same archive appears.
7. Confirm one user cannot see another user's records.

## 5. Build the iOS IPA

The iOS app is a thin native wrapper around the live web app, matching the architecture already used by WeTrack. The website remains the source of truth, so most future web updates immediately appear in the iOS app without rebuilding it.

1. In GitHub, open **Actions**.
2. Choose **Build Memories Unsigned IPA**.
3. Choose **Run workflow**.
4. Keep the defaults unless a different bundle identifier is needed.
5. When the run completes, download the `Memories-unsigned-ipa` artifact.
6. Install/resign it through Sideloadly using an Apple ID.

The workflow:

- runs on `macos-15`
- installs XcodeGen
- generates `Memories.xcodeproj` from `project.yml`
- builds without code signing
- validates the app bundle metadata
- packages `Payload/Memories.app` as an unsigned IPA
- uploads the IPA, raw app bundle, and diagnostics

## Architecture notes

### Web

The web client is deliberately static so it can live directly in the existing GitHub Pages repository. `app.js` loads Supabase JS as an ES module from jsDelivr.

### iOS

The native wrapper uses SwiftUI, WKWebView, persistent web data storage, pull-to-refresh, camera/photo permissions, OAuth-compatible navigation, native JavaScript alert/confirmation support, a launch experience, and an offline/retry screen.

### Privacy

The first release is private by default. `visibility = shared` is stored for future collaboration work, but this release does not expose another user's archive or create invitation access policies. That is intentional: collaboration should be added only with explicit membership tables and carefully tested RLS.

## Recommended next production phases

1. Collaborative memory invitations and separate perspectives
2. Voice recording and transcription
3. AI-assisted prompt generation through a protected Edge Function
4. Photo metadata and duplicate-event suggestions
5. Memory evidence/confidence editor at the individual-detail level
6. Encrypted downloadable archive containing original media files
7. App Store signing, native share extension, and notification reminders

## Cache updates

When editing web files, increment the query versions in `index.html` and the cache name in `sw.js`, for example:

```text
styles.css?v=2
app.js?v=2
whatmod-memories-v2
```

This prevents an older service worker cache from hiding a new deployment.
