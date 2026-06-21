import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2 } from 'lucide-react'
import { db } from '@/db/dexie'
import { saveGrinder, deleteGrinder } from '@/db/repo'
import type { BurrType, Grinder, GrinderType } from '@/db/types'
import { PageHeader, Field } from '@/components/ui'
import { SubNav } from '@/components/SubNav'
import { GrindConverter } from './GrindConverter'

export default function GrindersPage() {
  const { t } = useTranslation()
  const grinders = useLiveQuery(() => db.grinders.orderBy('name').toArray(), [])
  const [draft, setDraft] = useState<Partial<Grinder> | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft?.name || !draft.micronsPerClick) return
    await saveGrinder({
      id: draft.id,
      name: draft.name,
      type: (draft.type ?? 'hand') as GrinderType,
      burr: (draft.burr ?? 'conical') as BurrType,
      micronsPerClick: draft.micronsPerClick,
      maxClicks: draft.maxClicks,
      source: draft.source ?? 'user',
    })
    setDraft(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('grinder.title')}
        action={
          <button className="btn-primary" onClick={() => setDraft({ type: 'hand', burr: 'conical' })}>
            <Plus size={18} /> {t('grinder.addCustom')}
          </button>
        }
      />
      <SubNav active="grinders" />

      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('grinder.convert')}</h2>
      <GrindConverter />

      {draft && (
        <form onSubmit={submit} className="card space-y-3 p-4">
          <Field label={t('grinder.title')}>
            <input className="input" autoFocus value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('grinder.type')}>
              <select className="input" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as GrinderType })}>
                <option value="hand">{t('grinder.hand')}</option>
                <option value="electric">{t('grinder.electric')}</option>
              </select>
            </Field>
            <Field label={t('grinder.burr')}>
              <select className="input" value={draft.burr} onChange={(e) => setDraft({ ...draft, burr: e.target.value as BurrType })}>
                <option value="conical">{t('grinder.conical')}</option>
                <option value="flat">{t('grinder.flat')}</option>
              </select>
            </Field>
            <Field label={t('grinder.micronsPerClick')}>
              <input className="input" type="number" step="0.1" value={draft.micronsPerClick ?? ''} onChange={(e) => setDraft({ ...draft, micronsPerClick: Number(e.target.value) })} />
            </Field>
            <Field label={t('recipe.clicks')} hint="max">
              <input className="input" type="number" value={draft.maxClicks ?? ''} onChange={(e) => setDraft({ ...draft, maxClicks: e.target.value ? Number(e.target.value) : undefined })} />
            </Field>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">{t('common.save')}</button>
            <button type="button" className="btn-ghost" onClick={() => setDraft(null)}>{t('common.cancel')}</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {grinders?.map((g) => (
          <div key={g.id} className="card flex items-center justify-between p-3">
            <button className="text-left" onClick={() => setDraft(g)}>
              <p className="flex items-center gap-2 font-medium">
                {g.name}
                {g.estimated ? (
                  <span className="chip !bg-amber-500/15 !py-0.5 text-xs text-amber-600 dark:text-amber-400">
                    {t('grinder.estimated')}
                  </span>
                ) : null}
              </p>
              <p className="text-sm text-muted">
                {t('grinder.' + g.burr)} · {g.micronsPerClick} µm/{t('recipe.clicks')}
                {g.seeded ? '' : ' · ★'}
              </p>
            </button>
            {!g.seeded && (
              <button className="text-muted hover:text-red-500" onClick={() => deleteGrinder(g.id)}>
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
