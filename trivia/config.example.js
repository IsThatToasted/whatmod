window.TRIVIA_CONFIG = {
  appName: "WhatMod Trivia",
  publicUrl: "https://whatmod.com/trivia/",
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  // Use the new Supabase publishable key here, not a secret/service-role key.
  supabasePublishableKey: "sb_publishable_REPLACE_ME",

  // Optional Twitch integration. Create an app at dev.twitch.tv.
  twitchClientId: "",
  twitchRedirectUri: "https://whatmod.com/trivia/",

  // Demo mode lets the UI run before Supabase is configured.
  // Set false for production.
  demoMode: true
};
