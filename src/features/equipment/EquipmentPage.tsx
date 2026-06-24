import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2 } from 'lucide-react'
import { db } from '@/db/dexie'
import { saveGear, deleteGear, saveGrinder, deleteGrinder } from '@/db/repo'
import type { BurrType, Gear, Grinder, GrinderType } from '@/db/types'
import { PageHeader, Field, EmptyState } from '@/components/ui'
import { SubNav } from '@/components/SubNav'
import { GrindConverter } from '@/features/grinder/GrindConverter'

type Section = 'machines' | 'brewers' | 'grinders'

/**
 * Equipment hub — the physical kit: espresso machines, brewers, and grinders
 * (with the grind-setting converter). One tab, three sections, replacing the
 * old separate Gear and Grinders pages.
 */
export default function EquipmentPage() {
  const { t } = useTranslation()
  const gear = useLiveQuery(() => db.gear.orderBy('name').toArray(), [])
  const grinders = useLiveQuery(() => db.grinders.orderBy('name').toArray(), [])
  const [section, setSection] = useState<Section>('machines')
  const [gearDraft, setGearDraft] = useState<Partial<Gear> | null>(null)
  const [grindDraft, setGrindDraft] = useState<Partial<Grinder> | null>(null)

  const items = (gear ?? []).filter((g) => g.type === (section === 'machines' ? 'machine' : 'brewer'))

  async function submitGear(e: React.FormEvent) {
    e.preventDefault()
    if (!gearDraft?.name) return
    await saveGear({
      id: gearDraft.id,
      name: gearDraft.name,
      type: section === 'machines' ? 'machine' : 'brewer',
      brand: gearDraft.brand,
      notes: gearDraft.notes,
    })
    setGearDraft(null)
  }

  async function submitGrinder(e: React.FormEvent) {
    e.preventDefault()
    if (!grindDraft?.name || !grindDraft.micronsPerClick) return
    await saveGrinder({
      id: grindDraft.id,
      name: grindDraft.name,
      type: (grindDraft.type ?? 'hand') as GrinderType,
      burr: (grindDraft.burr ?? 'conical') as BurrType,
      micronsPerClick: grindDraft.micronsPerClick,
      maxClicks: grindDraft.maxClicks,
      source: grindDraft.source ?? 'user',
    })
    setGrindDraft(null)
  }

  const closeDrafts = () => {
    setGearDraft(null)
    setGrindDraft(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('equipment.title')} />
      <SubNav active="equipment" />

      {/* section switch */}
      <div className="flex gap-2">
        {(['machines', 'brewers', 'grinders'] as Section[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSection(s)
              closeDrafts()
            }}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm ${section === s ? 'bg-brand text-white' : 'bg-surface-2 text-muted'}`}
          >
            {t('equipment.' + s)}
          </button>
        ))}
      </div>

      {section === 'grinders' ? (
        <>
          <button className="btn-primary w-full" onClick={() => setGrindDraft({ type: 'hand', burr: 'conical' })}>
            <Plus size={18} /> {t('grinder.addCustom')}
          </button>

          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('grinder.convert')}</h2>
          <GrindConverter />

          {grindDraft && (
            <form onSubmit={submitGrinder} className="card space-y-3 p-4">
              <Field label={t('grinder.title')}>
                <input className="input" autoFocus value={grindDraft.name ?? ''} onChange={(e) => setGrindDraft({ ...grindDraft, name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('grinder.type')}>
                  <select className="input" value={grindDraft.type} onChange={(e) => setGrindDraft({ ...grindDraft, type: e.target.value as GrinderType })}>
                    <option value="hand">{t('grinder.hand')}</option>
                    <option value="electric">{t('grinder.electric')}</option>
                  </select>
                </Field>
                <Field label={t('grinder.burr')}>
                  <select className="input" value={grindDraft.burr} onChange={(e) => setGrindDraft({ ...grindDraft, burr: e.target.value as BurrType })}>
                    <option value="conical">{t('grinder.conical')}</option>
                    <option value="flat">{t('grinder.flat')}</option>
                  </select>
                </Field>
                <Field label={t('grinder.micronsPerClick')}>
                  <input className="input" type="number" step="0.1" value={grindDraft.micronsPerClick ?? ''} onChange={(e) => setGrindDraft({ ...grindDraft, micronsPerClick: Number(e.target.value) })} />
                </Field>
                <Field label={t('recipe.clicks')} hint="max">
                  <input className="input" type="number" value={grindDraft.maxClicks ?? ''} onChange={(e) => setGrindDraft({ ...grindDraft, maxClicks: e.target.value ? Number(e.target.value) : undefined })} />
                </Field>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary flex-1">{t('common.save')}</button>
                <button type="button" className="btn-ghost" onClick={() => setGrindDraft(null)}>{t('common.cancel')}</button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {grinders?.map((g) => (
              <div key={g.id} className="card flex items-center justify-between p-3">
                <button className="text-left" onClick={() => setGrindDraft(g)}>
                  <p className="flex items-center gap-2 font-medium">
                    {g.name}
                    {g.estimated ? (
                      <span className="chip !bg-amber-500/15 !py-0.5 text-xs text-amber-600 dark:text-amber-400">{t('grinder.estimated')}</span>
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
        </>
      ) : (
        <>
          <button className="btn-primary w-full" onClick={() => setGearDraft({})}>
            <Plus size={18} /> {section === 'machines' ? t('gear.addMachine') : t('gear.addBrewer')}
          </button>

          {gearDraft && (
            <form onSubmit={submitGear} className="card space-y-3 p-4">
              <Field label={t('gear.title')}>
                <input
                  className="input"
                  autoFocus
                  value={gearDraft.name ?? ''}
                  onChange={(e) => setGearDraft({ ...gearDraft, name: e.target.value })}
                  placeholder={section === 'machines' ? 'Gaggia Classic, La Pavoni…' : 'V60, AeroPress…'}
                />
              </Field>
              <Field label={t('gear.brand')}>
                <input className="input" value={gearDraft.brand ?? ''} onChange={(e) => setGearDraft({ ...gearDraft, brand: e.target.value })} />
              </Field>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary flex-1">{t('common.save')}</button>
                <button type="button" className="btn-ghost" onClick={() => setGearDraft(null)}>{t('common.cancel')}</button>
              </div>
            </form>
          )}

          {gear !== undefined &&
            (items.length === 0 ? (
              <EmptyState>{t('gear.empty')}</EmptyState>
            ) : (
              <div className="space-y-2">
                {items.map((g) => (
                  <div key={g.id} className="card flex items-center justify-between p-3">
                    <button className="text-left" onClick={() => setGearDraft(g)}>
                      <p className="font-medium">{g.name}{g.seeded ? '' : ' ★'}</p>
                      {g.brand && <p className="text-sm text-muted">{g.brand}</p>}
                    </button>
                    <button className="text-muted hover:text-red-500" onClick={() => deleteGear(g.id)}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
        </>
      )}
    </div>
  )
}
