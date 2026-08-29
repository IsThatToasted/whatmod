# Aurelium Field v0.5.4 — iOS Bundle Lookup Repair

## Fixed

- Corrects the iOS runtime configuration lookup that could produce `AF-CFG-001` even when CI verified `RuntimeConfig.json` existed inside the built app.
- The runtime loader now checks the bundle root, the `Resources` subdirectory, known resource URLs, and finally performs a bounded recursive lookup for the exact runtime configuration filename.
- Adds configuration-specific support codes `AF-CFG-101` through `AF-CFG-105` so future configuration failures identify the exact stage without revealing service/provider details to end users.
- The iOS workflow now reports the relative bundle location of `RuntimeConfig.json` without printing its contents.
- Adds a second verification pass against the final packaged IPA, not only the pre-packaged `.app`.

## Deployment

No database migration is required. Replace the repository-root `.github/workflows/ios-build.yml` with the v0.5.4 workflow and rebuild the IPA.
