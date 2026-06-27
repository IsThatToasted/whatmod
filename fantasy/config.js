// Fantasy Vault environment config
// Change APP_BASE_PATH when you move hosting, for example '/dating' or '/'.
window.FV_CONFIG = {
  APP_NAME: 'Fantasy Vault',
  // Change these two values when you move the app.
  APP_BASE_PATH: '/fantasy',
  // OAuth redirect is now calculated from the current hosted page automatically.
  // Keep this empty to avoid stale localhost redirects.
  AUTH_REDIRECT_URL: '',
  SUPABASE_URL: 'https://gqkkdocvfstbsekxyrbo.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_b00bWXNlvZo_Wprb8UwjSA_q5Pl8Cyi',
  USE_SUPABASE: true,
  LOCAL_FALLBACK: true
};
