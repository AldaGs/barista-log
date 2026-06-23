import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, GitMerge, Replace, AlertTriangle } from 'lucide-react'
import {
  planImport,
  applyImport,
  type Backup,
  type ImportMode,
  type ImportPlan,
} from '@/lib/backup'

/**
 * Preview a parsed backup against the live DB and let the user pick how to
 * apply it (merge vs replace) before anything is written. The preview makes the
 * two surprising cases obvious up front: duplicate catalog rows that will be
 * collapsed, and — in replace mode — records that will be removed.
 */
export function ImportBackupSheet({
  backup,
  onClose,
  onDone,
}: {
  backup: Backup
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<ImportMode>('merge')
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    setPlan(null)
    planImport(backup, mode).then((p) => {
      if (alive) setPlan(p)
    })
    return () => {
      alive = false
    }
  }, [backup, mode])

  const totals = useMemo(() => {
    const z = { added: 0, updated: 0, mergedDuplicates: 0, removed: 0 }
    if (!plan) return z
    for (const r of plan.tables) {
      z.added += r.added
      z.updated += r.updated
      z.mergedDuplicates += r.mergedDuplicates
      z.removed += r.removed
    }
    return z
  }, [plan])

  const apply = async () => {
    setBusy(true)
    try {
      await applyImport(backup, mode)
      onDone()
    } finally {
      setBusy(false)
    }
  }

  const rows = (plan?.tables ?? []).filter(
    (r) => r.added || r.updated || r.mergedDuplicates || r.removed,
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 rounded-t-2xl bg-surface p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('settings.import.title')}</h2>
          <button onClick={onClose} className="btn-ghost !px-2" aria-label={t('common.cancel')}>
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-muted">
          {t('settings.import.from', {
            date: new Date(backup.exportedAt).toLocaleString(),
          })}
        </p>

        {/* Strategy picker */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('merge')}
            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left ${
              mode === 'merge' ? 'border-brand bg-brand/5' : 'border-border'
            }`}
          >
            <span className="flex items-center gap-1.5 font-medium">
              <GitMerge size={16} /> {t('settings.import.merge')}
            </span>
            <span className="text-xs text-muted">{t('settings.import.mergeHint')}</span>
          </button>
          <button
            onClick={() => setMode('replace')}
            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left ${
              mode === 'replace' ? 'border-brand bg-brand/5' : 'border-border'
            }`}
          >
            <span className="flex items-center gap-1.5 font-medium">
              <Replace size={16} /> {t('settings.import.replace')}
            </span>
            <span className="text-xs text-muted">{t('settings.import.replaceHint')}</span>
          </button>
        </div>

        {/* Preview */}
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {plan === null ? (
            <p className="py-6 text-center text-sm text-muted">{t('settings.import.loading')}</p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{t('settings.import.noChanges')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted">
                  <th className="py-1 text-left font-medium">{t('settings.import.collection')}</th>
                  <th className="py-1 text-right font-medium">{t('settings.import.add')}</th>
                  <th className="py-1 text-right font-medium">{t('settings.import.update')}</th>
                  <th className="py-1 text-right font-medium">{t('settings.import.dupes')}</th>
                  <th className="py-1 text-right font-medium">{t('settings.import.remove')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.table} className="border-t border-border/60">
                    <td className="py-1.5">{t(`settings.collections.${r.table}`)}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.added || '·'}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.updated || '·'}</td>
                    <td className="py-1.5 text-right tabular-nums text-amber-600 dark:text-amber-400">
                      {r.mergedDuplicates || '·'}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-red-600 dark:text-red-400">
                      {r.removed || '·'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totals.mergedDuplicates > 0 && (
          <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
            {t('settings.import.dupesNote', { count: totals.mergedDuplicates })}
          </p>
        )}
        {mode === 'replace' && totals.removed > 0 && (
          <p className="flex items-start gap-1.5 rounded-lg bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {t('settings.import.removeNote', { count: totals.removed })}
          </p>
        )}

        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary flex-1" onClick={apply} disabled={busy || plan === null}>
            {mode === 'replace' ? t('settings.import.applyReplace') : t('settings.import.applyMerge')}
          </button>
        </div>
      </div>
    </div>
  )
}
