# WeTrack iOS Wrapper

This is a thin native iOS wrapper around the live web app at:

`https://whatmod.com/track/`

## Recommended sideload workflow

The included GitHub Actions workflow builds an **unsigned IPA**. This is intentional for Sideloadly: download the IPA artifact, then let Sideloadly sign/install it locally with your Apple ID, such as `Toasted3@icloud.com`.

No Apple certificate/provisioning-profile GitHub secrets are required for this unsigned workflow.

## Repo layout expected by GitHub Actions

The workflow expects this folder structure in your main `whatmod` repo:

```text
whatmod/
  .github/workflows/ios-ipa.yml
  track/
    index.html
    settings.html
    ios/WeTrack/WeTrack.xcodeproj
```

If your Xcode project lives somewhere else, edit `PROJECT_PATH` in `.github/workflows/ios-ipa.yml`.

## Building

1. Push the workflow to `.github/workflows/ios-ipa.yml` at the root of the repo.
2. Go to GitHub → Actions → **Build WeTrack Unsigned IPA**.
3. Click **Run workflow**.
4. Download the `WeTrack-unsigned-ipa` artifact.
5. Open Sideloadly and install the unsigned IPA using your Apple ID.

## Notes

- The app loads the live GitHub Pages site, so updating `/track` updates the app content.
- Some camera/photo features require HTTPS; `whatmod.com/track` is fine.
- iOS WebView behavior may differ slightly from Safari. Test Add Memory, login, maps, and modals on device.
