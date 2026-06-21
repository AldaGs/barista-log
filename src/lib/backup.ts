import { db } from '@/db/dexie'

const TABLES = ['beans', 'waters', 'grinders', 'gear', 'recipes', 'sessions', 'flavorTags'] as const

interface Backup {
  app: 'barista-log'
  version: 1
  exportedAt: string
  data: Record<string, unknown[]>
}

export async function exportBackup() {
  const data: Record<string, unknown[]> = {}
  for (const name of TABLES) {
    // Sessions may contain Blob photos which JSON can't hold — drop them.
    const rows = await db.table(name).toArray()
    data[name] = rows.map((r) => {
      const { photo: _drop, ...rest } = r as Record<string, unknown>
      return rest
    })
  }
  const backup: Backup = {
    app: 'barista-log',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `barista-log-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function importBackup(file: File) {
  const parsed = JSON.parse(await file.text()) as Backup
  if (parsed.app !== 'barista-log') throw new Error('Not a Slurry Stats backup file')
  await db.transaction('rw', TABLES.map((tbl) => db.table(tbl)), async () => {
    for (const name of TABLES) {
      const rows = parsed.data[name]
      if (Array.isArray(rows)) await db.table(name).bulkPut(rows)
    }
  })
}
