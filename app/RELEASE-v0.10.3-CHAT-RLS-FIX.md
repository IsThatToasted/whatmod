# Aurelium Field v0.10.3 — Build 28

## Chat reliability / RLS repair

This release repairs the Chat failures introduced with the v0.10.0 Chat schema while preserving the existing authentication/workspace architecture.

### Database repair — migration 010

Apply `010_chat_rls_repair.sql` **after migration 009**.

The original migration 009 used a `FOR ALL` policy on `chat_members` that queried `chat_conversations`. The `chat_conversations` SELECT policy in turn queried `chat_members`, producing PostgreSQL's `infinite recursion detected in policy for relation "chat_conversations"` error.

Migration 010:

- removes the recursive Chat policy cycle;
- introduces non-recursive SECURITY DEFINER access helpers;
- treats `channel` conversations as organization-wide for active organization members;
- keeps `direct` and `group` conversations membership-scoped;
- preserves creator and owner/admin moderation access;
- validates organization consistency for memberships and messages;
- narrows mutable Chat columns instead of leaving broad UPDATE grants;
- adds an organization-scoped `chat_list_members(...)` RPC that regular employees can use instead of the admin-only directory RPC;
- adds atomic `chat_create_channel(...)` channel creation so a channel and creator membership cannot be partially created;
- adds a message trigger that updates conversation ordering whenever a message is inserted;
- preserves all existing Chat rows/data.

### Web Chat

- no longer exposes raw Postgres/Supabase error text to users;
- conversation loading and teammate-directory enrichment are independent, so a directory problem cannot blank the whole Chat UI;
- uses `chat_list_members(...)` for employee-safe teammate identity display;
- uses atomic `chat_create_channel(...)` for New Channel;
- normalizes Chat reference codes:
  - `AF-CHAT-101` conversation load
  - `AF-CHAT-102` channel creation
  - `AF-CHAT-103` history load
  - `AF-CHAT-104` message send
- relies on the database trigger rather than requiring ordinary employees to update `chat_conversations` after sending.

### Native iOS Chat

- migration 010 resolves the existing `AF-CHAT-101` conversation-load failure;
- New Channel now uses the same atomic `chat_create_channel(...)` RPC as web;
- successful refresh/create/send operations clear stale Chat error banners;
- existing polling/message behavior is preserved.

### Version

- Native app: `0.10.3`
- Build: `28`
- Web package: `0.10.3`
- New schema migration: `010_chat_rls_repair.sql`

## Validation performed

- all native Swift source files parsed successfully;
- changed `Chat.tsx` passed TypeScript syntax/transpile validation;
- project/workflow YAML parsed successfully;
- Info.plist parsed successfully and version/build values remain strings;
- JSON resources parsed successfully;
- migration 010 checked for required repair functions/policies and balanced function bodies;
- frozen authentication files remain byte-identical to the stable v0.9.4 baseline;
- no `node_modules`, `dist`, or partial dependency-install artifacts are included.

A full local Vite dependency build could not be repeated in this environment because package-registry DNS/network access was unavailable. The previously corrected web baseline already built successfully in GitHub Actions; the changed Chat source itself passed TypeScript syntax/transpile validation.

## Upgrade order

For an existing v0.10.x database that already has migration 009:

1. Run **only** `010_chat_rls_repair.sql` in Supabase.
2. Deploy/upload the v0.10.3 project files.
3. Rebuild/install iOS Build 28 when desired.

Do **not** rerun migrations 001–009.
