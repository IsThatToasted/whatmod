# JustGlance v2.3.1 — Schema + Startup Repair

- Fixes Supabase pgcrypto resolution by explicitly using the `extensions` schema for `digest()` and `gen_random_bytes()`.
- Adds a master idempotent schema repair through migrations 001–005, including current invite, shopping bridge, contacts and universal-memory schema.
- Fixes the direct-static web crash caused by importing a non-existent `AddressBook` export from `lucide-react@0.544.0`; Contacts now uses the supported `ContactRound` icon.
- No GitHub Pages workflow changes. `/life` continues to deploy through the repository's shared `web-pages.yml` workflow.
