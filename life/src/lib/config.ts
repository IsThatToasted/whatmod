export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'
export const DEMO_MODE = String(import.meta.env.VITE_DEMO_MODE || '').toLowerCase() === 'true'
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const featureFlags = {
  AI_PARSING: false,
  LOCATION: true,
  CALENDAR_SYNC: false,
  PUSH_NOTIFICATIONS: false,
  WEATHER: false,
  SMART_SUGGESTIONS: true,
  DAILY_RESET: true,
  MORNING_BRIEF: true,
} as const
