import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { Plus, Trash2, Wrench, Check, CircleAlert } from 'lucide-react'
import { db } from '@/db/dexie'
import { saveMaintenance, deleteMaintenance, markMaintenanceDone } from '@/db/repo'
import type { MaintenanceKind, MaintenanceTask } from '@/db/types'
import { PageHeader, Field, EmptyState } from '@/components/ui'
import { SubNav } from '@/components/SubNav'
import {
  MAINTENANCE_KINDS,
  KIND_DEFAULT_INTERVAL,
  maintenanceState,
  type MaintenanceStatus,
} from '@/lib/maintenance'

const num = (v: string) => (v === '' ? undefined : Number(v))

const STATUS_CLASS: Record<MaintenanceStatus, string> = {
  ok: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  soon: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  overdue: 'bg-red-500/15 text-red-600 dark:text-red-400',
  unknown: 'bg-surface-2 text-muted',
}

export default function MaintenancePage() {
  const { t } = useTranslation()
  const tasks = useLiveQuery(() => db.maintenance.toArray(), [])
  const gear = useLiveQuery(() => db.gear.orderBy('name').toArray(), [])
  const grinders = useLiveQuery(() => db.grinders.orderBy('name').toArray(), [])
  const [draft, setDraft] = useState<Partial<MaintenanceTask> | null>(null)

  const kindLabel = (k: MaintenanceKind) => t('maintenance.kind.' + k)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    const kind = (draft.kind ?? 'other') as MaintenanceKind
    await saveMaintenance({
      id: draft.id,
      kind,
      label: draft.label?.trim() || kindLabel(kind),
      gearId: draft.gearId || undefined,
      grinderId: draft.grinderId || undefined,
      intervalDays: draft.intervalDays,
      lastDoneAt: draft.lastDoneAt,
      history: draft.history,
      notes: draft.notes,
    })
    setDraft(null)
  }

  const targetName = (task: MaintenanceTask) =>
    (task.gearId && gear?.find((g) => g.id === task.gearId)?.name) ||
    (task.grinderId && grinders?.find((g) => g.id === task.grinderId)?.name) ||
    null

  const sorted = (tasks ?? []).slice().sort((a, b) => {
    const rank = { overdue: 0, soon: 1, unknown: 2, ok: 3 }
    return rank[maintenanceState(a).status] - rank[maintenanceState(b).status]
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('maintenance.title')}
        action={
          <button
            className="btn-primary"
            onClick={() => setDraft({ kind: 'descale', intervalDays: KIND_DEFAULT_INTERVAL.descale })}
          >
            <Plus size={18} /> {t('common.add')}
          </button>
        }
      />
      <SubNav active="maintenance" />

      {draft && (
        <form onSubmit={submit} className="card space-y-3 p-4">
          <Field label={t('maintenance.kindLabel')}>
            <select
              className="input"
              value={draft.kind ?? 'other'}
              onChange={(e) => {
                const kind = e.target.value as MaintenanceKind
                setDraft((d) => ({
                  ...d,
                  kind,
                  // refresh the suggested interval unless the user already typed one
                  intervalDays:
                    d?.intervalDays == null || d.intervalDays === KIND_DEFAULT_INTERVAL[(d?.kind ?? 'other') as MaintenanceKind]
                      ? KIND_DEFAULT_INTERVAL[kind]
                      : d.intervalDays,
                }))
              }}
            >
              {MAINTENANCE_KINDS.map((k) => (
                <option key={k} value={k}>{kindLabel(k)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('maintenance.label')} hint={t('common.optional')}>
            <input className="input" value={draft.label ?? ''} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder={kindLabel((draft.kind ?? 'other') as MaintenanceKind)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('maintenance.appliesTo')} hint={t('common.optional')}>
              <select
                className="input"
                value={draft.gearId ?? (draft.grinderId ? `grinder:${draft.grinderId}` : '')}
                onChange={(e) => {
                  const v = e.target.value
                  if (v.startsWith('grinder:')) setDraft({ ...draft, grinderId: v.slice(8), gearId: undefined })
                  else setDraft({ ...draft, gearId: v || undefined, grinderId: undefined })
                }}
              >
                <option value="">{t('common.none')}</option>
                {gear?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                {grinders?.map((g) => <option key={g.id} value={`grinder:${g.id}`}>{g.name}</option>)}
              </select>
            </Field>
            <Field label={t('maintenance.interval')} hint={t('maintenance.days')}>
              <input className="input" type="number" inputMode="numeric" min={0} value={draft.intervalDays ?? ''} onChange={(e) => setDraft({ ...draft, intervalDays: num(e.target.value) })} />
            </Field>
          </div>
          <Field label={t('maintenance.notes')} hint={t('common.optional')}>
            <input className="input" value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">{t('common.save')}</button>
            <button type="button" className="btn-ghost" onClick={() => setDraft(null)}>{t('common.cancel')}</button>
          </div>
        </form>
      )}

      {tasks === undefined ? null : tasks.length === 0 && !draft ? (
        <EmptyState><Wrench /> {t('maintenance.empty')}</EmptyState>
      ) : (
        <div className="space-y-2">
          {sorted.map((task) => {
            const st = maintenanceState(task)
            const target = targetName(task)
            return (
              <div key={task.id} className="card p-3">
                <div className="flex items-start justify-between gap-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setDraft(task)}>
                    <p className="flex items-center gap-2 font-medium">
                      {st.status === 'overdue' && <CircleAlert size={14} className="shrink-0 text-red-500" />}
                      <span className="truncate">{task.label}</span>
                    </p>
                    {target && <p className="text-sm text-muted">{target}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className={`rounded-full px-2 py-0.5 ${STATUS_CLASS[st.status]}`}>
                        {st.status === 'unknown'
                          ? task.intervalDays
                            ? t('maintenance.never')
                            : t('maintenance.oneOff')
                          : st.status === 'overdue'
                            ? t('maintenance.overdueBy', { count: Math.abs(st.daysLeft ?? 0) })
                            : t('maintenance.dueIn', { count: st.daysLeft ?? 0 })}
                      </span>
                      {task.lastDoneAt && (
                        <span className="text-muted">{t('maintenance.lastDone', { date: format(task.lastDoneAt, 'PP') })}</span>
                      )}
                    </div>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button className="text-muted hover:text-red-500" onClick={() => deleteMaintenance(task.id)} aria-label={t('common.delete')}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <button className="btn-ghost mt-2 w-full" onClick={() => markMaintenanceDone(task.id)}>
                  <Check size={16} /> {t('maintenance.markDone')}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
