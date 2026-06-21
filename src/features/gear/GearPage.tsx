import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2, Coffee, Wrench } from 'lucide-react'
import { db } from '@/db/dexie'
import { saveGear, deleteGear } from '@/db/repo'
import type { Gear, GearType } from '@/db/types'
import { PageHeader, Field, EmptyState } from '@/components/ui'
import { SubNav } from '@/components/SubNav'

export default function GearPage() {
  const { t } = useTranslation()
  const gear = useLiveQuery(() => db.gear.orderBy('name').toArray(), [])
  const [draft, setDraft] = useState<Partial<Gear> | null>(null)

  const machines = gear?.filter((g) => g.type === 'machine') ?? []
  const brewers = gear?.filter((g) => g.type === 'brewer') ?? []

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft?.name) return
    await saveGear({
      id: draft.id,
      name: draft.name,
      type: (draft.type ?? 'brewer') as GearType,
      brand: draft.brand,
      notes: draft.notes,
    })
    setDraft(null)
  }

  const Group = ({ title, items }: { title: string; items: Gear[] }) => (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {items.length === 0 ? (
        <EmptyState>{t('gear.empty')}</EmptyState>
      ) : (
        items.map((g) => (
          <div key={g.id} className="card flex items-center justify-between p-3">
            <button className="text-left" onClick={() => setDraft(g)}>
              <p className="font-medium">{g.name}{g.seeded ? '' : ' ★'}</p>
              {g.brand && <p className="text-sm text-muted">{g.brand}</p>}
            </button>
            <button className="text-muted hover:text-red-500" onClick={() => deleteGear(g.id)}>
              <Trash2 size={18} />
            </button>
          </div>
        ))
      )}
    </section>
  )

  return (
    <div className="space-y-4">
      <PageHeader title={t('gear.title')} />
      <SubNav active="gear" />

      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={() => setDraft({ type: 'machine' })}>
          <Wrench size={16} /> {t('gear.addMachine')}
        </button>
        <button className="btn-primary flex-1" onClick={() => setDraft({ type: 'brewer' })}>
          <Coffee size={16} /> {t('gear.addBrewer')}
        </button>
      </div>

      {draft && (
        <form onSubmit={submit} className="card space-y-3 p-4">
          <Field label={t('gear.type')}>
            <select className="input" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as GearType })}>
              <option value="machine">{t('gear.machine')}</option>
              <option value="brewer">{t('gear.brewerKind')}</option>
            </select>
          </Field>
          <Field label={t('gear.title')}>
            <input className="input" autoFocus value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={draft.type === 'machine' ? 'Gaggia Classic, La Pavoni…' : 'V60, AeroPress…'} />
          </Field>
          <Field label={t('gear.brand')}>
            <input className="input" value={draft.brand ?? ''} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">{t('common.save')}</button>
            <button type="button" className="btn-ghost" onClick={() => setDraft(null)}>{t('common.cancel')}</button>
          </div>
        </form>
      )}

      {gear !== undefined && (
        <>
          <Group title={t('gear.machines')} items={machines} />
          <Group title={t('gear.brewers')} items={brewers} />
        </>
      )}
    </div>
  )
}
