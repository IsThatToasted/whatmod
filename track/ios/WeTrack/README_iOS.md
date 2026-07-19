# WeTrack iOS Wrapper

This is a thin SwiftUI + WKWebView iOS wrapper for the live WeTrack web app at:

```text
https://whatmod.com/track/
```

The web app remains hosted in the main `whatmod` repo under `/track`, so your Supabase logic and feature updates stay centralized.

## Bundle ID

Default bundle ID:

```text
com.whatmod.wetrack
```

You can override it in GitHub Actions using the `IOS_BUNDLE_ID` secret.

## Permissions

The app includes camera/photo usage descriptions so the web app memory upload flow can use camera/photo picker in WKWebView.

## Building an IPA

Use the included workflow:

```text
.github/workflows/ios-ipa.yml
```

A real installable IPA requires Apple signing secrets.
