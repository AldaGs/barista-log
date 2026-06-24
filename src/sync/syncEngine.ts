import { db, now } from '@/db/dexie'
import { getSupabase } from './supabaseClient'

/**
 * Local-first cloud sync (backup/restore).
 *
 * Every change is already written to IndexedDB first; this pushes a copy to
 * Supabase and pulls back anything newer from other devices. Conflicts resolve
 * last-write-wins by `updatedAt`. Records live in one generic `sync_records`
 * table (see supabase/schema.sql); deletes propagate via local tombstones.
 */
export const SYNCED_COLLECTIONS = ['beans', 'waters', 'grinders', 'gear', 'recipes', 'sessions', 'profile', 'maintenance', 'practice'] as const
type Collection = (typeof SYNCED_COLLECTIONS)[number]

export interface SyncResult {
  pushed: number
  pulled: number
  at: number
}

const cursorKey = (userId: string) => `barista-sync-cursor:${userId}`

function stripLocal<T extends Record<string, unknown>>(row: T) {
  // Don't ship Blobs or local-only bookkeeping fields.
  const { photo: _p, dirty: _d, syncedAt: _s, ...rest } = row as Record<string, unknown>
  return rest
}

export async function syncNow(): Promise<SyncResult | { skipped: true; reason: string }> {
  const supabase = getSupabase()
  if (!supabase) return { skipped: true, reason: 'not-connected' }

  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) return { skipped: true, reason: 'signed-out' }

  // --- PULL first, merging remote changes since our cursor (LWW) -----------
  const cursor = Number(localStorage.getItem(cursorKey(userId)) ?? 0)
  const { data: remote, error: pullErr } = await supabase
    .from('sync_records')
    .select('id, collection, updated_at, deleted, data')
    .gt('updated_at', cursor)
    .order('updated_at', { ascending: true })
  if (pullErr) throw pullErr

  let pulled = 0
  let maxSeen = cursor
  for (const r of remote ?? []) {
    maxSeen = Math.max(maxSeen, r.updated_at)
    const table = db.table(r.collection as Collection)
    const local = (await table.get(r.id)) as { updatedAt?: number } | undefined
    if (r.deleted) {
      if (local) {
        await table.delete(r.id)
        pulled++
      }
      continue
    }
    // Skip if our local copy is newer or equal (we'll push ours instead).
    if (local && (local.updatedAt ?? 0) >= r.updated_at) continue
    await table.put({ ...(r.data as object), dirty: 0, syncedAt: now() })
    pulled++
  }
  if (maxSeen > cursor) localStorage.setItem(cursorKey(userId), String(maxSeen))

  // --- PUSH local dirty rows + tombstones ----------------------------------
  const payload: {
    id: string
    user_id: string
    collection: string
    updated_at: number
    deleted: number
    data: unknown
  }[] = []

  for (const name of SYNCED_COLLECTIONS) {
    const dirty = await db.table(name).where('dirty').equals(1).toArray()
    for (const row of dirty) {
      payload.push({
        id: row.id,
        user_id: userId,
        collection: name,
        updated_at: row.updatedAt,
        deleted: 0,
        data: stripLocal(row),
      })
    }
  }
  const tombstones = await db.deletions.toArray()
  for (const tomb of tombstones) {
    payload.push({
      id: tomb.id,
      user_id: userId,
      collection: tomb.collection,
      updated_at: tomb.updatedAt,
      deleted: 1,
      data: null,
    })
  }

  let pushed = 0
  if (payload.length) {
    const { error: pushErr } = await supabase
      .from('sync_records')
      .upsert(payload, { onConflict: 'user_id,id' })
    if (pushErr) throw pushErr

    // Mark pushed rows clean and clear tombstones.
    const ts = now()
    for (const name of SYNCED_COLLECTIONS) {
      const dirty = await db.table(name).where('dirty').equals(1).toArray()
      await db.table(name).bulkPut(dirty.map((r: any) => ({ ...r, dirty: 0, syncedAt: ts })))
    }
    await db.deletions.clear()
    // Advance cursor past our own writes so we don't re-pull them.
    const pushedMax = Math.max(...payload.map((p) => p.updated_at))
    if (pushedMax > maxSeen) localStorage.setItem(cursorKey(userId), String(pushedMax))
    pushed = payload.length
  }

  return { pushed, pulled, at: now() }
}

/** Restore a fresh device: reset the cursor so the next sync pulls everything. */
export function resetSyncCursor(userId: string) {
  localStorage.removeItem(cursorKey(userId))
}
