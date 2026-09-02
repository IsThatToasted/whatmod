# Aurelium Field v0.10.1 — Build 26
## Web + iOS CI stabilization

This is a corrective release on top of v0.10.0 Build 25. It preserves the v0.10.0 Payroll, Chat, walkthrough-editing, navigation, and exterior-estimating work while addressing the first GitHub Actions failures seen after that release.

## Web build fix

GitHub TypeScript compilation reported:

- `'supabase' is possibly 'null'`

The failure was in the Chat realtime subscription cleanup. The effect now captures the configured Supabase client into a local non-null `client` before creating the channel and uses that same client in cleanup. This preserves the existing optional-cloud configuration while satisfying strict TypeScript control-flow analysis.

The web build marker is now `v0.10.1-build-fix`, and the Pages verification step checks the matching marker.

## iOS build stabilization

The failed iOS Actions run reached `SwiftCompile` / `CompileSwift` and exited 65, but the supplied tail did not contain the underlying Swift diagnostic. The v0.10-only native code was hardened in the areas most likely to fail at the Swift frontend/type-check stage:

- Chat views now use the same `@State private var cloud = WorkspaceService.shared` pattern as the stable authenticated views.
- Payroll editor no longer reads the MainActor workspace singleton from a custom initializer; the organization ID is passed in explicitly.
- Payroll settings bindings were rewritten as explicit typed `Binding` values instead of optional write-through expressions.
- Chat, payroll, walkthrough editing, exterior measurement, and workspace switching were split into smaller SwiftUI subviews/computed sections instead of large single expressions.
- Chat polling uses the conservative `Task.sleep(nanoseconds:)` form supported by the deployment target/toolchain.
- Release builds run Swift in single-file compilation mode with batch mode disabled. This reduces batch-frontend fragility and makes future diagnostics identify the actual failing source file.
- The iOS workflow now extracts Swift/Xcode compiler diagnostics from `xcodebuild-device.log` into the failed step before exiting.
- IPA/log artifact names were updated for v0.10.1.

## Stability protections retained

The frozen authentication/workspace source remains byte-identical to the stable baseline:

- `WorkspaceService.swift`
- `AuthView.swift`
- `AureliumFieldApp.swift`

The custom `aureliumfield://auth-callback` flow, Keychain/session behavior, `get_my_workspace()` bootstrap, explicit Swift source manifest, and string-typed bundle version protections are unchanged.

## Version

- App version: `0.10.1`
- Build: `26`
- Web release marker: `v0.10.1-build-fix`
- Database migration: no new migration; v0.10.1 continues to use migration `009_payroll_chat_walkthrough_editing.sql` from v0.10.0.

## Local validation performed

- Parsed every Swift source file with the Swift frontend.
- Validated `project.yml`, workflow YAML, JSON, and Info.plist syntax.
- Verified every explicit XcodeGen Swift source path exists.
- Verified `CFBundleShortVersionString` and `CFBundleVersion` remain strings.
- Verified frozen auth file SHA-256 hashes still match the stable workflow baseline.
- Verified retired native auth files are not present in the active source tree.
- Shell-syntax checked the updated iOS device-build workflow block.
- Verified ZIP integrity after packaging.

A full Xcode type-check/device build cannot run in this Linux container, so GitHub Actions remains the authoritative Apple toolchain build. The workflow has been improved so any remaining compiler issue will surface the actual diagnostic rather than only a generic exit 65.
