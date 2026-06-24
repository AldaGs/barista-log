import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, Coffee, AlertTriangle, Tag } from 'lucide-react'
import { db } from '@/db/dexie'
import { saveBean, deleteBean } from '@/db/repo'
import type { Bean } from '@/db/types'
import { PageHeader, Field, EmptyState } from '@/components/ui'
import { SubNav } from '@/components/SubNav'
import { freshness, stock, type FreshnessStatus } from '@/lib/freshness'
import { useSettings } from '@/store/settings'

const ROAST_LEVELS: NonNullable<Bean['roastLevel']>[] = [
  'light',
  'medium-light',
  'medium',
  'medium-dark',
  'dark',
]

const FRESHNESS_CLASS: Record<FreshnessStatus, string> = {
  unknown: 'bg-surface-2 text-muted',
  resting: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  peak: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  fading: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  stale: 'bg-red-500/15 text-red-600 dark:text-red-400',
}

const num = (v: string) => (v === '' ? undefined : Number(v))

export default function BeansPage() {
  const { t } = useTranslation()
  const beans = useLiveQuery(() => db.beans.orderBy('name').toArray(), [])
  const labelCount = useLiveQuery(() => db.labels.count(), [])
  const [draft, setDraft] = useState<Partial<Bean> | null>(null)
  const costTracking = useSettings((s) => s.costTracking)
  const currency = useSettings((s) => s.currency)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft?.name) return
    // New bag with a size but no explicit remaining → start full.
    const gramsRemaining =
      draft.gramsRemaining ?? (!draft.id && draft.bagSize ? draft.bagSize : draft.gramsRemaining)
    await saveBean({
      id: draft.id,
      name: draft.name,
      roaster: draft.roaster,
      origin: draft.origin,
      process: draft.process,
      roastLevel: draft.roastLevel,
      roastDate: draft.roastDate,
      bagSize: draft.bagSize,
      price: draft.price,
      gramsRemaining,
      notes: draft.notes,
    })
    setDraft(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('beans.title')}
        action={
          <button className="btn-primary" onClick={() => setDraft({})}>
            <Plus size={18} /> {t('common.add')}
          </button>
        }
      />
      <SubNav active="beans" />

      <Link to="/labels" className="chip w-fit">
        <Tag size={14} /> {t('labels.title')}
        {labelCount ? <span className="text-muted">· {labelCount}</span> : null}
      </Link>

      {draft && (
        <form onSubmit={submit} className="card space-y-3 p-4">
          <Field label={t('beans.title')}>
            <input className="input" autoFocus value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('beans.roaster')}><input className="input" value={draft.roaster ?? ''} onChange={(e) => setDraft({ ...draft, roaster: e.target.value })} /></Field>
            <Field label={t('beans.origin')}><input className="input" value={draft.origin ?? ''} onChange={(e) => setDraft({ ...draft, origin: e.target.value })} /></Field>
            <Field label={t('beans.process')}><input className="input" value={draft.process ?? ''} onChange={(e) => setDraft({ ...draft, process: e.target.value })} /></Field>
            <Field label={t('beans.roastLevel')}>
              <select className="input" value={draft.roastLevel ?? ''} onChange={(e) => setDraft({ ...draft, roastLevel: (e.target.value || undefined) as Bean['roastLevel'] })}>
                <option value="">{t('common.none')}</option>
                {ROAST_LEVELS.map((l) => (
                  <option key={l} value={l}>{t('beans.level.' + l)}</option>
                ))}
              </select>
            </Field>
            <Field label={t('beans.roastDate')}><input className="input" type="date" value={draft.roastDate ?? ''} onChange={(e) => setDraft({ ...draft, roastDate: e.target.value })} /></Field>
            <Field label={t('beans.bagSize')} hint="g"><input className="input" type="number" inputMode="decimal" value={draft.bagSize ?? ''} onChange={(e) => setDraft({ ...draft, bagSize: num(e.target.value) })} /></Field>
            {costTracking && (
              <Field label={t('beans.price')} hint={currency}><input className="input" type="number" inputMode="decimal" value={draft.price ?? ''} onChange={(e) => setDraft({ ...draft, price: num(e.target.value) })} /></Field>
            )}
            {draft.id && (
              <Field label={t('beans.remaining')} hint="g"><input className="input" type="number" inputMode="decimal" value={draft.gramsRemaining ?? ''} onChange={(e) => setDraft({ ...draft, gramsRemaining: num(e.target.value) })} /></Field>
            )}
          </div>
          {draft.id && draft.bagSize ? (
            <button type="button" className="text-sm font-medium text-brand" onClick={() => setDraft({ ...draft, gramsRemaining: draft.bagSize })}>
              {t('beans.refill')}
            </button>
          ) : null}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">{t('common.save')}</button>
            <button type="button" className="btn-ghost" onClick={() => setDraft(null)}>{t('common.cancel')}</button>
          </div>
        </form>
      )}

      {beans === undefined ? null : beans.length === 0 && !draft ? (
        <EmptyState><Coffee /> {t('beans.empty')}</EmptyState>
      ) : (
        <div className="space-y-2">
          {beans?.map((b) => {
            const f = freshness(b)
            const s = stock(b)
            return (
              <div key={b.id} className="card flex items-center justify-between gap-3 p-3">
                <button className="min-w-0 flex-1 text-left" onClick={() => setDraft(b)}>
                  <p className="flex items-center gap-2 font-medium">
                    <span className="truncate">{b.name}</span>
                    {f.status === 'resting' && <AlertTriangle size={14} className="shrink-0 text-amber-500" />}
                  </p>
                  <p className="text-sm text-muted">{[b.roaster, b.origin].filter(Boolean).join(' · ') || '—'}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {f.status !== 'unknown' && (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${FRESHNESS_CLASS[f.status]}`}>
                        {f.status === 'resting'
                          ? t('beans.freshness.restingDays', { count: Math.max(f.restDays - (f.ageDays ?? 0), 0) })
                          : t('beans.freshness.' + f.status)}
                        {f.ageDays != null && f.status !== 'resting' ? ` · ${t('beans.daysOld', { count: f.ageDays })}` : ''}
                      </span>
                    )}
                    {s.grams != null && (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${s.isEmpty ? 'bg-red-500/15 text-red-600 dark:text-red-400' : s.isLow ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-surface-2 text-muted'}`}>
                        {s.isEmpty ? t('beans.empty2') : t('beans.gramsLeft', { grams: s.grams })}
                      </span>
                    )}
                  </div>
                </button>
                <button className="shrink-0 text-muted hover:text-red-500" onClick={() => deleteBean(b.id)}>
                  <Trash2 size={18} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
