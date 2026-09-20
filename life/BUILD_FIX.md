# Build Fix — Supabase Realtime cleanup

Fixed the strict TypeScript build error:

`src/contexts/AppDataContext.tsx(237,25): TS18047: 'supabase' is possibly 'null'`

The Realtime effect now captures the already-null-checked Supabase client in a local `client` constant and uses that same non-null client for channel creation and cleanup.

This is a compile-safety change only; Realtime behavior is unchanged.
