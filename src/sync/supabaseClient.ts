import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useSettings } from '@/store/settings'

let client: SupabaseClient | null = null
let cacheKey = ''

/**
 * Lazily create the Supabase client ONLY when the user has connected an account
 * in Settings (or provided build-time env vars). Returns null otherwise, so the
 * app stays fully local-first by default.
 */
export function getSupabase(): SupabaseClient | null {
  const cfg =
    useSettings.getState().supabase ??
    (import.meta.env.VITE_SUPABASE_URL
      ? { url: import.meta.env.VITE_SUPABASE_URL, anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY }
      : null)

  if (!cfg?.url || !cfg.anonKey) {
    client = null
    return null
  }
  const key = `${cfg.url}:${cfg.anonKey}`
  if (!client || key !== cacheKey) {
    client = createClient(cfg.url, cfg.anonKey)
    cacheKey = key
  }
  return client
}

export const isCloudEnabled = () => getSupabase() !== null
