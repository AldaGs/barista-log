import { db } from '@/db/dexie'

const TABLES = ['beans', 'waters', 'grinders', 'gear', 'recipes', 'sessions', 'flavorTags', 'profile'] as const

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

export async function importBackup(file: File) {
  const parsed = JSON.parse(await file.text()) as Backup
  await applyBackup(parsed)
}
