# WeTrack V2.0 Deployment Checklist

## 1. Back up

- Export the existing `/track` folder or create a Git tag.
- Back up the Supabase database before applying the migration.

## 2. Database

- Run `schema.sql` once in the Supabase SQL editor.
- Confirm the script completes without errors.
- Verify realtime publications and storage policies remain enabled.

## 3. Web deployment

- Replace the contents of the repository's `/track` folder with this release.
- Keep `index.html`, `app.js`, `styles.css`, `settings.html`, assets, and supporting folders together.
- Commit and wait for GitHub Pages deployment.
- Hard refresh `https://whatmod.com/track/` and confirm assets load with cache version `v450`.

## 4. Critical smoke test

- Sign in and switch trips.
- Click **Trip Details → Edit**.
- Change Destination and wait for the Saved status/toast.
- Reload and confirm the destination persists.
- Create, edit, drag, and delete an itinerary event.
- Upload and delete a memory.
- Open Fun Ideas from two trips owned by the same user and confirm the same bucket list appears.
- Save onboarding, sign out/in, and confirm it does not return.
- Verify the notification center shows only the nearest pending reminder per event.
- Verify shopping totals and travel expenses still reconcile.

## 5. iOS build

- Copy `repo-root/.github/workflows/ios-ipa.yml` to `.github/workflows/ios-ipa.yml` in the repository root.
- Ensure the project exists at `track/ios/WeTrack/WeTrack.xcodeproj`.
- Run **Build WeTrack Unsigned IPA** manually in GitHub Actions.
- Download the unsigned IPA artifact and install using Sideloadly.
- If the build fails, download `WeTrack-xcode-diagnostics` and inspect `xcodebuild.log` for the first `error:` line.

## 6. OAuth and notifications

- Supabase redirect allowlist must include `wetrack://auth-callback` and the production web URL.
- Test Google sign-in from Safari/web and from the iOS wrapper.
- Grant notification permission and verify both configured event reminders are scheduled.

## 7. Release sign-off

- Run `python scripts/production_audit.py`.
- Confirm zero failed checks.
- Tag the deployed commit as `wetrack-v2.0.0`.
