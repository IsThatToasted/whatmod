# Bedroom Connection Builder

A static GitHub Pages app backed by Supabase. Each adult signs in with Google, creates a private profile, joins a one-on-one bedroom compatibility builder, answers privately, and sees live compatibility card updates when both people answer.

## Important

This version removes all Supabase embedded joins from the frontend to avoid PostgREST schema-cache join errors. It also ships as `app-v3.js` with a cache-busted script tag so GitHub Pages does not keep serving an older broken `app.js`.

## Setup

1. Put your Supabase URL and anon/publishable key in `config.js`.
2. Run `supabase-schema.sql` in Supabase SQL Editor.
3. In Supabase Auth, enable Google OAuth.
4. Add your GitHub Pages URL to allowed redirect URLs.
5. Deploy these files.

Adults 18+ only.
