import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, Droplets, FlaskConical } from 'lucide-react'
import { db } from '@/db/dexie'
import { saveWater, deleteWater } from '@/db/repo'
import type { WaterProfile } from '@/db/types'
import { PageHeader, Field, EmptyState } from '@/components/ui'
import { SubNav } from '@/components/SubNav'
import {
  WATER_PRESETS,
  mineralRecipe,
  makeConcentratePlan,
} from '@/lib/waterRecipe'

const num = (v: string) => (v === '' ? undefined : Number(v))

/** DIY mineral-recipe calculator: target GH/KH → grams to add per batch. */
function WaterBuilder({ onSaveProfile }: { onSaveProfile: (w: Partial<WaterProfile>) => void }) {
  const { t } = useTranslation()
  const [gh, setGh] = useState('68')
  const [kh, setKh] = useState('40')
  const [litres, setLitres] = useState('1')
  const [mode, setMode] = useState<'direct' | 'concentrate'>('direct')

  const target = { gh: Number(gh) || 0, kh: Number(kh) || 0 }
  const L = Number(litres) || 0

  const dose = useMemo(() => mineralRecipe(target, L), [target.gh, target.kh, L])
  const plan = useMemo(() => makeConcentratePlan(target), [target.gh, target.kh])

  const activePreset = WATER_PRESETS.find((p) => p.gh === target.gh && p.kh === target.kh)?.id

  return (
    <div className="card space-y-4 p-4">
      <div className="flex items-center gap-2">
        <FlaskConical size={18} className="text-brand" />
        <h2 className="font-medium">{t('water.builder.title')}</h2>
      </div>
      <p className="text-sm text-muted">{t('water.builder.intro')}</p>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {WATER_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setGh(String(p.gh))
              setKh(String(p.kh))
            }}
            className={`chip ${activePreset === p.id ? '!bg-brand !text-brand-fg' : ''}`}
          >
            {t(`water.builder.preset.${p.id}`)}
          </button>
        ))}
      </div>

      {/* Targets */}
      <div className="grid grid-cols-3 gap-3">
        <Field label={t('water.builder.targetGh')}>
          <input className="input" type="number" inputMode="decimal" value={gh} onChange={(e) => setGh(e.target.value)} />
        </Field>
        <Field label={t('water.builder.targetKh')}>
          <input className="input" type="number" inputMode="decimal" value={kh} onChange={(e) => setKh(e.target.value)} />
        </Field>
        <Field label={t('water.builder.batch')}>
          <input className="input" type="number" inputMode="decimal" min={0} value={litres} onChange={(e) => setLitres(e.target.value)} />
        </Field>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        {(['direct', 'concentrate'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm ${mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted'}`}
          >
            {t(`water.builder.mode.${m}`)}
          </button>
        ))}
      </div>

      {/* Result */}
      {mode === 'direct' ? (
        <div className="space-y-2 rounded-lg bg-surface-2 p-3 text-sm">
          <p className="text-muted">{t('water.builder.directHint', { litres: L })}</p>
          <div className="flex justify-between">
            <span>{t('water.builder.epsom')}</span>
            <span className="font-medium tabular-nums">{dose.epsomG} g</span>
          </div>
          <div className="flex justify-between">
            <span>{t('water.builder.bicarb')}</span>
            <span className="font-medium tabular-nums">{dose.bicarbG} g</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg bg-surface-2 p-3 text-sm">
          <p className="text-muted">{t('water.builder.concentrateHint', { g: plan.epsomStockG })}</p>
          <div className="flex justify-between">
            <span>{t('water.builder.epsomConc')}</span>
            <span className="font-medium tabular-nums">{plan.epsomMlPerL} {t('water.builder.mlPerL')}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('water.builder.bicarbConc')}</span>
            <span className="font-medium tabular-nums">{plan.bicarbMlPerL} {t('water.builder.mlPerL')}</span>
          </div>
        </div>
      )}

      <button
        className="btn-ghost w-full"
        onClick={() =>
          onSaveProfile({
            name: activePreset ? t(`water.builder.preset.${activePreset}`) : `GH ${target.gh} / KH ${target.kh}`,
            gh: target.gh,
            kh: target.kh,
            tds: dose.addedTds,
            notes: t('water.builder.savedNote', {
              epsom: dose.epsomG,
              bicarb: dose.bicarbG,
              litres: L,
            }),
          })
        }
      >
        <Plus size={16} /> {t('water.builder.saveAsProfile')}
      </button>
    </div>
  )
}

export default function WaterPage() {
  const { t } = useTranslation()
  const waters = useLiveQuery(() => db.waters.orderBy('name').toArray(), [])
  const [draft, setDraft] = useState<Partial<WaterProfile> | null>(null)
  const [showBuilder, setShowBuilder] = useState(false)

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

      <button
        className={`chip ${showBuilder ? '!bg-brand !text-brand-fg' : ''}`}
        onClick={() => setShowBuilder((v) => !v)}
      >
        <FlaskConical size={14} /> {t('water.builder.title')}
      </button>

      {showBuilder && (
        <WaterBuilder
          onSaveProfile={(w) => {
            setDraft(w)
            setShowBuilder(false)
          }}
        />
      )}

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
