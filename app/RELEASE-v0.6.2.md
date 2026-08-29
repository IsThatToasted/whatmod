# Aurelium Field v0.6.2 — GitHub Upload / iOS Build Fix

## What failed
The v0.6.1 iOS workflow was stopping in the auth-baseline assertion before Xcode ran. The current repository still contains `app/ios/AureliumField/Services/NativeGoogleAuth.swift` from v0.6.0. GitHub's browser "Add files via upload" adds/replaces files but does not remove files that are absent from a newer upload.

## Fix
- The iOS workflow now removes the retired `NativeGoogleAuth.swift` from the Actions checkout before XcodeGen.
- `project.yml` explicitly excludes `Services/NativeGoogleAuth.swift` as defense in depth, so a retained stale source cannot be compiled.
- The brittle shell `grep` chain was replaced with a Python validation that reports exactly which handoff component is missing.
- Supabase runtime inputs continue to resolve from either existing repository Variables or Secrets:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- No Google iOS client variables are required.
- No database migration is required.

## Repository cleanup
The release does not contain `NativeGoogleAuth.swift`. It is still worth deleting that stale file from GitHub once, but v0.6.2 will build safely even if a browser upload leaves it behind.
