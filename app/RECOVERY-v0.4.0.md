# Aurelium Field — recovered v0.4.0 baseline

This recovery package is based directly on the user-supplied `Aurelium-Field-v0.4.0-admin-workspace(1).zip`.

Only the iOS runtime cloud-configuration path was changed:
- The web app is unchanged.
- The v0.4.0 admin/employee workspace is unchanged.
- OAuth/login behavior is unchanged from v0.4.0.
- Database migrations are unchanged.
- GitHub continues using the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` Variables/Secrets.
- iOS now receives those values through a bundled `RuntimeConfig.json` resource instead of Info.plist build-setting substitution.
- XcodeGen now enumerates the exact known-good Swift files from this baseline so stale experimental auth files left in GitHub are not compiled.

No new SQL migration is required.
