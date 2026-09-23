const runtime = window.__JUSTGLANCE_CONFIG__ || {};
const metaEnv = (import.meta.env || {});
export const APP_VERSION = runtime.appVersion || metaEnv.VITE_APP_VERSION || '2.3.0';
export const DEMO_MODE = runtime.demoMode === true || String(metaEnv.VITE_DEMO_MODE || '').toLowerCase() === 'true';
export const SUPABASE_URL = runtime.supabaseUrl || metaEnv.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = runtime.supabaseAnonKey || metaEnv.VITE_SUPABASE_ANON_KEY || '';
export const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const NATIVE_IOS = Boolean(window.__JUSTGLANCE_NATIVE__?.platform === 'ios');
export const featureFlags = {
    AI_PARSING: false,
    LOCATION: true,
    CALENDAR_SYNC: false,
    PUSH_NOTIFICATIONS: NATIVE_IOS,
    WEATHER: false,
    SMART_SUGGESTIONS: true,
    DAILY_RESET: true,
    MORNING_BRIEF: true,
};
