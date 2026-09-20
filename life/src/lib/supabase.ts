import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { HAS_SUPABASE, SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

function createSupabaseClient(): SupabaseClient | null {
  if (!HAS_SUPABASE) return null
  try {
    const parsed = new URL(SUPABASE_URL)
    if (parsed.protocol !== 'https:' || !parsed.hostname) {
      console.error('[JustGlance] Invalid Supabase URL. Cloud features are disabled for this session.')
      return null
    }
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      realtime: { params: { eventsPerSecond: 8 } },
    })
  } catch (error) {
    console.error('[JustGlance] Supabase client could not be initialized. Cloud features are disabled for this session.', error)
    return null
  }
}

export const supabase = createSupabaseClient()
