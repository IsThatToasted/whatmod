# Trivia Admin

Static admin dashboard served from `/triviaadmin/`.

It reads the browser-safe Supabase configuration from `../trivia/config.js`. Do not create a second config file and never place a service-role/secret key in this folder.

Access is enforced server-side by Supabase RPC functions that require `profiles.is_admin = true`.

Remember to allow `https://whatmod.com/triviaadmin/` as a Supabase Auth redirect URL.


## Local Media Pipeline

V9 adds export/import controls that pair with `WhatMod-Trivia-Media-Resolver-Windows.zip`. The local app uses no Supabase secret and writes nothing directly to the database.
