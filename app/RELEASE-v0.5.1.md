# Aurelium Field v0.5.1 — iOS Configuration Reliability + Public Error Codes

## iOS configuration fix

The iOS workflow no longer relies on arbitrary Xcode command-line build settings being expanded into the runtime plist. It now:

1. Reads the same repository Actions Variables/Secrets used by web.
2. Fails early with `AF-CFG-001` if either value is missing or invalid.
3. Injects the public runtime client URL/key directly into the source Info.plist on the ephemeral GitHub runner.
4. Builds the physical-device app.
5. Reads the **actual built app Info.plist** and verifies both values are present and are not unresolved placeholders.
6. Packages the IPA only after verification succeeds.

Values are intentionally not printed in workflow logs.

## Public error codes

Production UI no longer displays raw backend/provider errors or infrastructure names. Errors render as neutral descriptions plus stable references, e.g.:

`We couldn't submit that timecard. Reference: AF-TIME-004`

The full engineering lookup is in `ERROR_CODES.md`.

## Provider-name cleanup

Login/onboarding setup notices and iOS authentication UI no longer expose backend implementation/provider terminology to end users. Raw technical errors are limited to local DEBUG/development diagnostics.

## Database

No new SQL migration is required for v0.5.1.
