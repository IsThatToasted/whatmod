# Aurelium Field v0.5.3

## iOS runtime configuration hardening

- Replaces compiled/base64 runtime constants with a dedicated `RuntimeConfig.json` app resource.
- GitHub Actions generates the resource from the existing repository Actions Variables/Secrets before XcodeGen runs.
- Xcode explicitly copies the resource into the application bundle.
- The workflow verifies the **actual RuntimeConfig.json inside the built `.app`** against the build inputs before packaging the IPA.
- The native client now reads only the bundled runtime resource for production cloud configuration.
- No SQL migration is required.
