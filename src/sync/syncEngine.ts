import { db } from '@/db/dexie'
import { getSupabase } from './supabaseClient'

/**
 * Opt-in cloud sync scaffolding.
 *
 * Strategy (last-write-wins, push then pull):
 *  1. Push every local row with dirty=1 to its Supabase table.
 *  2. Pull rows updated since our last sync and upsert locally.
 *
 * Every record already carries `dirty` / `syncedAt` / `updatedAt`, so enabling
 * full sync later requires no schema migration. See supabase/schema.sql for the
 * matching tables and RLS policies.
 *
 * This is intentionally a guarded stub: it returns early unless the user has
 * connected Supabase, so it never runs for local-only users.
 */
const SYNCED_TABLES = ['beans', 'waters', 'grinders', 'recipes', 'sessions'] as const

export async function syncNow(): Promise<{ pushed: number } | { skipped: true }> {
  const supabase = getSupabase()
  if (!supabase) return { skipped: true }

  let pushed = 0
  for (const name of SYNCED_TABLES) {
    const dirty = await db.table(name).where('dirty').equals(1).toArray()
    if (!dirty.length) continue
    // sessions hold Blob photos that need separate Storage handling — omit for now.
    const payload = dirty.map(({ photo: _p, ...rest }: any) => rest)
    const { error } = await supabase.from(name).upsert(payload)
    if (error) throw error
    const ts = Date.now()
    await db.table(name).bulkPut(dirty.map((r: any) => ({ ...r, dirty: 0, syncedAt: ts })))
    pushed += dirty.length
  }
  // Pull is left for the full implementation once tables exist server-side.
  return { pushed }
}
