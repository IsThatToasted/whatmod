# Memories deployment checklist

## Repository

- [ ] Copy the `memories/` folder into the repository root
- [ ] Copy `.github/workflows/memories-ios-ipa.yml` into the existing workflows folder
- [ ] Confirm the existing WeTrack workflow was not overwritten
- [ ] Commit and push to `main`
- [ ] Open `https://whatmod.com/memories/`
- [ ] Confirm CSS and JavaScript load without 404 errors

## Supabase

- [ ] Run `memories/schema.sql`
- [ ] Confirm all `memory_*` tables exist
- [ ] Confirm RLS is enabled on every `memory_*` table
- [ ] Confirm the private `memory-media` bucket exists
- [ ] Set the Site URL to `https://whatmod.com/memories/`
- [ ] Add the three documented redirect URL patterns
- [ ] Enable Email authentication
- [ ] Enable Google only after its OAuth callback is configured

## Functional test

- [ ] Demo mode opens without an account
- [ ] Account creation succeeds
- [ ] Email confirmation or password sign-in succeeds
- [ ] A memory can be created and edited
- [ ] A fragment can be created without a date
- [ ] A photo uploads and returns after refresh
- [ ] People and places are created from a memory
- [ ] A pathway can be created and reordered by selection
- [ ] Timeline filters work
- [ ] Constellation opens and memory nodes are selectable
- [ ] JSON export downloads
- [ ] Sign-out returns to the landing page

## Security test

- [ ] Create two separate test users
- [ ] Verify each user sees only their own memories
- [ ] Verify Storage objects cannot be opened by the other user
- [ ] Verify signed media URLs expire
- [ ] Never add a Supabase service-role key to any web or iOS file

## iOS

- [ ] Run `Build Memories Unsigned IPA` in GitHub Actions
- [ ] Confirm XcodeGen succeeds
- [ ] Confirm the Release iPhoneOS build succeeds
- [ ] Download the unsigned IPA artifact
- [ ] Install with Sideloadly
- [ ] Confirm login persistence after closing and reopening the app
- [ ] Confirm photo picker and camera permissions work
- [ ] Confirm Google OAuth returns to the archive, or use email/password in the wrapper
