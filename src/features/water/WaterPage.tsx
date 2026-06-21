import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, Droplets } from 'lucide-react'
import { db } from '@/db/dexie'
import { saveWater, deleteWater } from '@/db/repo'
import type { WaterProfile } from '@/db/types'
import { PageHeader, Field, EmptyState } from '@/components/ui'
import { SubNav } from '@/components/SubNav'

const num = (v: string) => (v === '' ? undefined : Number(v))

export default function WaterPage() {
  const { t } = useTranslation()
  const waters = useLiveQuery(() => db.waters.orderBy('name').toArray(), [])
  const [draft, setDraft] = useState<Partial<WaterProfile> | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft?.name) return
    await saveWater({
      id: draft.id,
      name: draft.name,
      supplier: draft.supplier,
      tds: draft.tds,
      gh: draft.gh,
      kh: draft.kh,
      notes: draft.notes,
    })
    setDraft(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('water.title')}
        action={
          <button className="btn-primary" onClick={() => setDraft({})}>
            <Plus size={18} /> {t('common.add')}
          </button>
        }
      />
      <SubNav active="water" />

      {draft && (
        <form onSubmit={submit} className="card space-y-3 p-4">
          <Field label={t('water.title')}>
            <input className="input" autoFocus value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Third Wave Water, Tap…" />
          </Field>
          <Field label={t('water.supplier')}>
            <input className="input" value={draft.supplier ?? ''} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('water.tds')}><input className="input" type="number" value={draft.tds ?? ''} onChange={(e) => setDraft({ ...draft, tds: num(e.target.value) })} /></Field>
            <Field label={t('water.gh')}><input className="input" type="number" value={draft.gh ?? ''} onChange={(e) => setDraft({ ...draft, gh: num(e.target.value) })} /></Field>
            <Field label={t('water.kh')}><input className="input" type="number" value={draft.kh ?? ''} onChange={(e) => setDraft({ ...draft, kh: num(e.target.value) })} /></Field>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">{t('common.save')}</button>
            <button type="button" className="btn-ghost" onClick={() => setDraft(null)}>{t('common.cancel')}</button>
          </div>
        </form>
      )}

      {waters === undefined ? null : waters.length === 0 && !draft ? (
        <EmptyState><Droplets /> {t('water.empty')}</EmptyState>
      ) : (
        <div className="space-y-2">
          {waters?.map((w) => (
            <div key={w.id} className="card flex items-center justify-between p-3">
              <button className="text-left" onClick={() => setDraft(w)}>
                <p className="font-medium">{w.name}</p>
                <p className="text-sm text-muted">
                  {[w.supplier, w.tds != null ? `${w.tds} ppm` : null].filter(Boolean).join(' · ')}
                </p>
              </button>
              <button className="text-muted hover:text-red-500" onClick={() => deleteWater(w.id)}>
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
