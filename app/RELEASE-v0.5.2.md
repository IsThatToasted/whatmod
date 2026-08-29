# Aurelium Field v0.5.2

## iOS runtime configuration hardening

- Removed the iOS runtime dependency on custom Info.plist build-setting expansion.
- GitHub Actions now creates `RuntimeConfig.swift` from the existing public web client values before Xcode compilation.
- Values are base64 encoded in generated Swift source to avoid quoting/build-setting interpolation issues.
- The iOS app reads the compiled runtime configuration first.
- The workflow verifies the generated values match the GitHub build inputs and confirms `RuntimeConfig.swift` is in the Xcode Swift compile file list before packaging the IPA.
- The workflow fails with `AF-CFG-001` instead of packaging a disconnected app if configuration generation or compilation wiring fails.

No database migration is required.
