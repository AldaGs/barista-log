import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/dexie'
import { saveCupping } from '@/db/repo'
import type { Cupping } from '@/db/types'
import { PageHeader, Field, ScoreSlider } from '@/components/ui'
import {
  QUALITY_ATTRS,
  CUP_ATTRS,
  DEFAULT_QUALITY,
  DEFAULT_CUP,
  cuppingScore,
} from '@/lib/cupping'

/** New/edit a SCA cupping. Routed as /bean/:id/cup (new) or /cupping/:cid/edit. */
export default function CuppingFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id: beanIdParam, cid } = useParams()

  const existing = useLiveQuery(() => (cid ? db.cuppings.get(cid) : undefined), [cid])
  const beanId = cid ? existing?.beanId : beanIdParam

  const [draft, setDraft] = useState<Partial<Cupping>>({})
  // Seed once from the existing record when editing.
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    if (cid && existing && !seeded) {
      setDraft(existing)
      setSeeded(true)
    }
  }, [cid, existing, seeded])

  if (cid && existing === undefined) return null

  const total = cuppingScore(draft)
  const set = (patch: Partial<Cupping>) => setDraft((d) => ({ ...d, ...patch }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!beanId) return
    await saveCupping({
      id: cid,
      beanId,
      date: draft.date ?? Date.now(),
      fragrance: draft.fragrance ?? DEFAULT_QUALITY,
      flavor: draft.flavor ?? DEFAULT_QUALITY,
      aftertaste: draft.aftertaste ?? DEFAULT_QUALITY,
      acidity: draft.acidity ?? DEFAULT_QUALITY,
      body: draft.body ?? DEFAULT_QUALITY,
      balance: draft.balance ?? DEFAULT_QUALITY,
      overall: draft.overall ?? DEFAULT_QUALITY,
      uniformity: draft.uniformity ?? DEFAULT_CUP,
      cleanCup: draft.cleanCup ?? DEFAULT_CUP,
      sweetness: draft.sweetness ?? DEFAULT_CUP,
      defects: draft.defects,
      notes: draft.notes,
    })
    navigate(`/bean/${beanId}`)
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <PageHeader title={t('cupping.title')} back />

      {/* Live total */}
      <div className="card flex items-baseline justify-center gap-2 p-4 text-center">
        <span className="text-4xl font-bold tabular-nums text-brand">{total.toFixed(2)}</span>
        <span className="text-muted">/ 100</span>
      </div>

      {/* Quality attributes, 6.00–10.00 */}
      <section className="card space-y-4 p-4">
        <h2 className="font-semibold">{t('cupping.quality')}</h2>
        {QUALITY_ATTRS.map((k) => (
          <ScoreSlider
            key={k}
            label={t('cupping.attr.' + k)}
            min={6}
            max={10}
            step={0.25}
            value={draft[k] ?? DEFAULT_QUALITY}
            onChange={(v) => set({ [k]: v } as Partial<Cupping>)}
          />
        ))}
      </section>

      {/* 5-cup attributes — count of clean cups (×2 points) */}
      <section className="card space-y-4 p-4">
        <h2 className="font-semibold">{t('cupping.cups')}</h2>
        <p className="text-xs text-muted">{t('cupping.cupsHint')}</p>
        {CUP_ATTRS.map((k) => {
          const cleanCups = (draft[k] ?? DEFAULT_CUP) / 2
          return (
            <div key={k}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted">{t('cupping.attr.' + k)}</span>
                <span className="tabular-nums text-text">{(draft[k] ?? DEFAULT_CUP).toFixed(0)}/10</span>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((cup) => (
                  <button
                    key={cup}
                    type="button"
                    onClick={() => set({ [k]: cup * 2 } as Partial<Cupping>)}
                    className={`h-9 flex-1 rounded-md text-sm font-medium ${
                      cup <= cleanCups ? 'bg-brand text-white' : 'bg-surface-2 text-muted'
                    }`}
                    aria-label={`${cup}`}
                  >
                    {cup}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </section>

      {/* Defects + notes */}
      <section className="card space-y-3 p-4">
        <Field label={t('cupping.defects')} hint={t('cupping.defectsHint')}>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={draft.defects ?? ''}
            onChange={(e) => set({ defects: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </Field>
        <Field label={t('recipe.notes')}>
          <textarea className="input min-h-24" value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </section>

      <button type="submit" className="btn-primary w-full">{t('common.save')}</button>
    </form>
  )
}
