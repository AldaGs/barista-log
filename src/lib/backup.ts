import { db, now } from '@/db/dexie'
import type { Label } from '@/db/types'

const TABLES = ['beans', 'waters', 'grinders', 'gear', 'recipes', 'sessions', 'flavorTags', 'profile', 'maintenance', 'practice', 'cuppings'] as const

// --- Label images -----------------------------------------------------------
// Labels hold a Blob image that the generic table path can't serialize. We carry
// them separately as base64 data URLs so the curated collection survives in the
// JSON / Drive backup (unlike session photos, which are intentionally dropped).

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

async function dataURLToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}

/** Serialize every label with its image inlined as a data URL. */
async function buildLabels(): Promise<Record<string, unknown>[]> {
  const labels = await db.labels.toArray()
  return Promise.all(
    labels.map(async ({ image, ...rest }) => ({
      ...rest,
      image: image ? await blobToDataURL(image) : undefined,
    })),
  )
}

/** Decode + upsert labels from a backup (image data URL → Blob). Skipped if absent. */
async function restoreLabels(parsed: Backup) {
  const rows = parsed.data.labels
  if (!Array.isArray(rows) || !rows.length) return
  const decoded: Label[] = []
  for (const row of rows as Record<string, unknown>[]) {
    const { image, ...rest } = row
    decoded.push({
      ...(rest as Omit<Label, 'image'>),
      image: typeof image === 'string' ? await dataURLToBlob(image) : (image as Blob),
    })
  }
  await db.labels.bulkPut(decoded)
}

/**
 * Catalog tables whose rows are identified to humans by a unique name. The app
 * re-seeds these on every fresh install with fresh random ids, so the *same*
 * grinder/brewer can exist under two different ids after an import — once from
 * the seed, once from the backup. We collapse those name-duplicates on import
 * so the user never has to hand-delete them. Recipes/sessions are id-only
 * (titles legitimately repeat across forks) and are reconciled by id alone.
 */
const DEDUPE_TABLES = ['beans', 'waters', 'grinders', 'gear'] as const

/** Foreign keys on recipes/sessions that point at a DEDUPE_TABLES row. */
const RECIPE_REFS = ['beanId', 'waterId', 'grinderId', 'gearId'] as const
const SESSION_REFS = ['beanId', 'waterId', 'grinderId'] as const

const nameKey = (r: Record<string, unknown>) =>
  String(r.name ?? '').trim().toLowerCase()

const LAST_BACKUP_KEY = 'barista-last-backup-at'

/** Epoch ms of the last JSON export, or null if never backed up on this device. */
export function lastBackupAt(): number | null {
  const v = Number(localStorage.getItem(LAST_BACKUP_KEY))
  return v > 0 ? v : null
}

export interface Backup {
  app: 'barista-log'
  version: 1
  exportedAt: string
  data: Record<string, unknown[]>
}

/**
 * Snapshot every synced table into a plain JSON-safe object. Shared by the
 * file export and the Google Drive backup so both produce identical payloads.
 * Blob photos are dropped (JSON can't hold them, same as cloud sync).
 */
export async function buildBackup(): Promise<Backup> {
  const data: Record<string, unknown[]> = {}
  for (const name of TABLES) {
    const rows = await db.table(name).toArray()
    data[name] = rows.map((r) => {
      const { photo: _drop, ...rest } = r as Record<string, unknown>
      return rest
    })
  }
  data.labels = await buildLabels()
  return {
    app: 'barista-log',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
}

/** Merge a parsed backup back into the local DB (last value wins per id). */
export async function applyBackup(parsed: Backup) {
  if (parsed.app !== 'barista-log') throw new Error('Not a Slurry Stats backup file')
  await db.transaction('rw', TABLES.map((tbl) => db.table(tbl)), async () => {
    for (const name of TABLES) {
      const rows = parsed.data[name]
      if (Array.isArray(rows)) await db.table(name).bulkPut(rows)
    }
  })
  await restoreLabels(parsed)
}

// ---------------------------------------------------------------------------
// Smart import — preview a backup against the live DB, then apply it with a
// chosen strategy. Handles the two ways an import can surprise a user:
//   1. seed/backup name-duplicates (same grinder, two ids) — always collapsed,
//      with recipe/session references repointed to the surviving id.
//   2. records the backup doesn't have — kept on "merge", removed on "replace".
// ---------------------------------------------------------------------------

/**
 * - `merge`   — add new + update existing by id; collapse name-duplicates. Never
 *               removes records the backup omits. Safe, additive.
 * - `replace` — make the local DB mirror the backup exactly: also delete every
 *               record the backup doesn't contain (a clean restore).
 */
export type ImportMode = 'merge' | 'replace'

export interface TablePlan {
  table: (typeof TABLES)[number]
  added: number
  updated: number
  unchanged: number
  /** local rows folded into a backup row by matching name (always cleaned up) */
  mergedDuplicates: number
  /** local rows deleted because the backup omits them (replace mode only) */
  removed: number
}

export interface ImportPlan {
  exportedAt: string
  tables: TablePlan[]
}

/** Build a remap of local dedupe-table id -> surviving backup id (name match). */
async function buildNameRemap(parsed: Backup) {
  const remap = new Map<string, string>()
  const mergedPerTable: Record<string, Set<string>> = {}
  for (const table of DEDUPE_TABLES) {
    mergedPerTable[table] = new Set()
    const incoming = (parsed.data[table] ?? []) as Record<string, unknown>[]
    const backupIds = new Set(incoming.map((r) => String(r.id)))
    const byName = new Map(incoming.map((r) => [nameKey(r), String(r.id)]))
    const local = (await db.table(table).toArray()) as Record<string, unknown>[]
    for (const row of local) {
      const id = String(row.id)
      if (backupIds.has(id)) continue // same id wins by id, not name
      const survivor = byName.get(nameKey(row))
      if (survivor && survivor !== id) {
        remap.set(id, survivor)
        mergedPerTable[table].add(id)
      }
    }
  }
  return { remap, mergedPerTable }
}

function sameRecord(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Dry-run: describe what an import would do, without touching the DB. */
export async function planImport(parsed: Backup, mode: ImportMode): Promise<ImportPlan> {
  if (parsed.app !== 'barista-log') throw new Error('Not a Slurry Stats backup file')
  const { mergedPerTable } = await buildNameRemap(parsed)
  const tables: TablePlan[] = []
  for (const table of TABLES) {
    const incoming = (parsed.data[table] ?? []) as Record<string, unknown>[]
    const local = (await db.table(table).toArray()) as Record<string, unknown>[]
    const localById = new Map(local.map((r) => [String(r.id), r]))
    const backupIds = new Set(incoming.map((r) => String(r.id)))
    const merged = mergedPerTable[table] ?? new Set<string>()

    let added = 0
    let updated = 0
    let unchanged = 0
    for (const row of incoming) {
      const cur = localById.get(String(row.id))
      if (!cur) added++
      else if (sameRecord(cur, row)) unchanged++
      else updated++
    }
    const removed =
      mode === 'replace'
        ? local.filter((r) => !backupIds.has(String(r.id)) && !merged.has(String(r.id))).length
        : 0
    tables.push({ table, added, updated, unchanged, mergedDuplicates: merged.size, removed })
  }
  return { exportedAt: parsed.exportedAt, tables }
}

/** Apply the remap to a record's foreign keys, returning a changed copy or null. */
function repoint(
  row: Record<string, unknown>,
  refs: readonly string[],
  remap: Map<string, string>,
) {
  let changed = false
  const next = { ...row }
  for (const k of refs) {
    const v = row[k]
    if (typeof v === 'string' && remap.has(v)) {
      next[k] = remap.get(v)
      changed = true
    }
  }
  return changed ? next : null
}

/** Execute an import with the chosen strategy (see {@link ImportMode}). */
export async function applyImport(parsed: Backup, mode: ImportMode) {
  if (parsed.app !== 'barista-log') throw new Error('Not a Slurry Stats backup file')
  const { remap, mergedPerTable } = await buildNameRemap(parsed)
  const ts = now()

  await db.transaction(
    'rw',
    [...TABLES.map((t) => db.table(t)), db.deletions],
    async () => {
      // 1) Upsert everything the backup carries.
      for (const table of TABLES) {
        const rows = parsed.data[table]
        if (Array.isArray(rows) && rows.length) await db.table(table).bulkPut(rows)
      }

      // 2) Repoint local-only recipes/sessions off any collapsed duplicate id.
      if (remap.size) {
        const recipes = (await db.recipes.toArray()) as unknown as Record<string, unknown>[]
        const fixedR = recipes
          .map((r) => repoint(r, RECIPE_REFS, remap))
          .filter(Boolean) as Record<string, unknown>[]
        if (fixedR.length) await db.recipes.bulkPut(fixedR as never)

        const sessions = (await db.sessions.toArray()) as unknown as Record<string, unknown>[]
        const fixedS = sessions
          .map((s) => repoint(s, SESSION_REFS, remap))
          .filter(Boolean) as Record<string, unknown>[]
        if (fixedS.length) await db.sessions.bulkPut(fixedS as never)
      }

      // 3) Delete the collapsed duplicate rows (+ tombstones so the delete sticks).
      for (const table of DEDUPE_TABLES) {
        const ids = [...(mergedPerTable[table] ?? [])]
        if (ids.length) {
          await db.table(table).bulkDelete(ids)
          await db.deletions.bulkPut(ids.map((id) => ({ id, collection: table, updatedAt: ts })))
        }
      }

      // 4) Replace mode: drop anything the backup omits, mirroring it exactly.
      if (mode === 'replace') {
        for (const table of TABLES) {
          const backupIds = new Set((parsed.data[table] ?? []).map((r) => String((r as { id: string }).id)))
          const local = (await db.table(table).toArray()) as { id: string }[]
          const stray = local.map((r) => r.id).filter((id) => !backupIds.has(id))
          if (stray.length) {
            await db.table(table).bulkDelete(stray)
            await db.deletions.bulkPut(stray.map((id) => ({ id, collection: table, updatedAt: ts })))
          }
        }
      }
    },
  )

  // Labels live outside the generic table set (Blob images) — merge them in
  // separately. Replace mode also drops local labels the backup omits.
  await restoreLabels(parsed)
  if (mode === 'replace') {
    const backupIds = new Set((parsed.data.labels ?? []).map((r) => String((r as { id: string }).id)))
    const strayLabels = (await db.labels.toArray()).map((l) => l.id).filter((id) => !backupIds.has(id))
    if (strayLabels.length) await db.labels.bulkDelete(strayLabels)
  }
}

/** Record that a backup just happened (local marker, any destination). */
export function markBackedUp() {
  localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()))
}

export async function exportBackup() {
  const backup = await buildBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `slurry-stats-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  markBackedUp()
}

/** Parse + validate a backup file (used before showing the import preview). */
export async function parseBackupFile(file: File): Promise<Backup> {
  const parsed = JSON.parse(await file.text()) as Backup
  if (parsed?.app !== 'barista-log') throw new Error('Not a Slurry Stats backup file')
  return parsed
}

export async function importBackup(file: File) {
  await applyImport(await parseBackupFile(file), 'merge')
}
