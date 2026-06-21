import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, Coffee } from 'lucide-react'
import { db } from '@/db/dexie'
import { saveBean, deleteBean } from '@/db/repo'
import type { Bean } from '@/db/types'
import { PageHeader, Field, EmptyState } from '@/components/ui'
import { SubNav } from '@/components/SubNav'

export default function BeansPage() {
  const { t } = useTranslation()
  const beans = useLiveQuery(() => db.beans.orderBy('name').toArray(), [])
  const [draft, setDraft] = useState<Partial<Bean> | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft?.name) return
    await saveBean({
      id: draft.id,
      name: draft.name,
      roaster: draft.roaster,
      origin: draft.origin,
      process: draft.process,
      roastLevel: draft.roastLevel,
      roastDate: draft.roastDate,
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

      {draft && (
        <form onSubmit={submit} className="card space-y-3 p-4">
          <Field label={t('beans.title')}>
            <input className="input" autoFocus value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('beans.roaster')}><input className="input" value={draft.roaster ?? ''} onChange={(e) => setDraft({ ...draft, roaster: e.target.value })} /></Field>
            <Field label={t('beans.origin')}><input className="input" value={draft.origin ?? ''} onChange={(e) => setDraft({ ...draft, origin: e.target.value })} /></Field>
            <Field label={t('beans.process')}><input className="input" value={draft.process ?? ''} onChange={(e) => setDraft({ ...draft, process: e.target.value })} /></Field>
            <Field label={t('beans.roastDate')}><input className="input" type="date" value={draft.roastDate ?? ''} onChange={(e) => setDraft({ ...draft, roastDate: e.target.value })} /></Field>
          </div>
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
          {beans?.map((b) => (
            <div key={b.id} className="card flex items-center justify-between p-3">
              <button className="text-left" onClick={() => setDraft(b)}>
                <p className="font-medium">{b.name}</p>
                <p className="text-sm text-muted">{[b.roaster, b.origin].filter(Boolean).join(' · ')}</p>
              </button>
              <button className="text-muted hover:text-red-500" onClick={() => deleteBean(b.id)}>
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
