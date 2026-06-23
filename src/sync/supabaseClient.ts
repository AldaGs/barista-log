import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useSettings } from '@/store/settings'

let client: SupabaseClient | null = null
let cacheKey = ''

/**
 * ⚠️ SUPABASE INTEGRATION IS CURRENTLY DISABLED (2026-06-23).
 *
 * Why: we moved cloud backup to the user's own Google Drive (see
 * `googleDrive.ts`). The goal is to NOT store user data on any server we
 * control — so we no longer want a Supabase project holding people's logs.
 * The free Supabase tier also pauses after ~1 week of inactivity, which made it
 * an unreliable backup target.
 *
 * The full sync engine (syncEngine.ts / syncManager.ts / useAuth.ts) and the
 * `CloudSync` settings UI are left intact but dormant: this single choke point
 * returns null, so nothing ever connects, auto-syncs, or authenticates.
 *
 * To revisit later: flip SUPABASE_ENABLED to true and restore the
 * `<CloudSync />` render in SettingsPage.tsx. Everything downstream still works.
 */
const SUPABASE_ENABLED = false

export function getSupabase(): SupabaseClient | null {
  // Hard-off switch — see the note above. Flip the flag to re-enable.
  if (!SUPABASE_ENABLED) return null

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
