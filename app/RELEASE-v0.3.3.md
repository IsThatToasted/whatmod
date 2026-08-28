# Aurelium Field v0.3.3 — iOS Build Fix

## Fixed
- Corrected the SwiftUI timecard editor optional String binding that caused Xcode device builds to fail with exit code 65.
- `costCode` and `notes` remain optional in the data model while presenting non-optional `Binding<String>` values to SwiftUI `TextField` controls.
- Empty edited values are converted back to `nil` before saving.

## Build log diagnosis
The failing v0.3.2 build contained one actual Swift compiler error in `Features/Team/TeamView.swift` at the Cost code field. The remaining concurrency and deprecation messages were warnings under the app's Swift 5.10 build setting.

No Supabase migration is required for this release.
