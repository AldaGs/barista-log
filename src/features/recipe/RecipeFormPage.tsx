import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/dexie'
import { getProfile, saveRecipe, saveSession } from '@/db/repo'
import type { BrewMethod, Recipe } from '@/db/types'
import { PageHeader, Field, StarRating, ScoreSlider } from '@/components/ui'
import { TagInput } from '@/components/TagInput'
import { FlavorWheel } from '@/components/FlavorWheel'
import { PhotoInput } from '@/components/PhotoInput'
import { BrewTimer } from '@/components/BrewTimer'
import { BrewSteps } from '@/components/BrewSteps'
import { ClockInput } from '@/components/ClockInput'
import { GrindConverter } from '@/features/grinder/GrindConverter'
import { InlineGearAdd } from '@/features/gear/InlineGearAdd'
import { useSettings } from '@/store/settings'
import { cToF, fToC, formatSeconds } from '@/lib/units'

const num = (v: string) => (v === '' ? undefined : Number(v))

export default function RecipeFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const [params] = useSearchParams()
  const tempUnit = useSettings((s) => s.tempUnit)

  const beans = useLiveQuery(() => db.beans.orderBy('name').toArray(), [])
  const waters = useLiveQuery(() => db.waters.orderBy('name').toArray(), [])
  const grinders = useLiveQuery(() => db.grinders.orderBy('name').toArray(), [])
  const gear = useLiveQuery(() => db.gear.orderBy('name').toArray(), [])

  const [form, setForm] = useState<Partial<Recipe>>({ method: 'brew' })
  // session fields (logged alongside the recipe)
  const [rating, setRating] = useState(0)
  const [flavors, setFlavors] = useState({ acidity: 0, body: 0, sweetness: 0, bitterness: 0 })
  const [tags, setTags] = useState<string[]>([])
  const [tds, setTds] = useState('')
  const [beverageWeight, setBeverageWeight] = useState('')
  const [photo, setPhoto] = useState<Blob | undefined>()
  const [showConverter, setShowConverter] = useState(false)

  // Load existing recipe (edit), duplicate source (?from), or fork source (?fork).
  const forkId = params.get('fork') ?? undefined
  const sourceId = id ?? params.get('from') ?? forkId ?? undefined
  useEffect(() => {
    if (!sourceId) return
    db.recipes.get(sourceId).then((r) => {
      if (!r) return
      if (id) setForm(r)
      else if (forkId)
        setForm({ ...r, id: undefined, title: `${r.title} (fork)`, forkedFromId: r.id }) // linked fork
      else setForm({ ...r, id: undefined, title: `${r.title} (copy)`, forkedFromId: undefined }) // unlinked copy
    })
  }, [sourceId, id, forkId])

  // Brand-new recipe (no edit/duplicate/fork source): prefill from profile defaults.
  useEffect(() => {
    if (sourceId) return
    getProfile().then((p) => {
      if (!p) return
      setForm((f) => ({
        ...f,
        method: p.defaultMethod ?? f.method,
        beanId: p.defaultBeanId ?? f.beanId,
        grinderId: p.defaultGrinderId ?? f.grinderId,
        gearId: p.defaultGearId ?? f.gearId,
        ratio: p.defaultRatio ?? f.ratio,
        doseIn: p.defaultDoseIn ?? f.doseIn,
        waterTemp: p.defaultWaterTemp ?? f.waterTemp,
      }))
    })
  }, [sourceId])

  const set = (patch: Partial<Recipe>) => setForm((f) => ({ ...f, ...patch }))
  const isEspresso = form.method === 'espresso'

  const ratio = useMemo(
    () => (form.doseIn && form.yieldOut ? (form.yieldOut / form.doseIn).toFixed(2) : null),
    [form.doseIn, form.yieldOut],
  )

  // Totals derived from the pour schedule, for one-tap auto-fill.
  const stepTotals = useMemo(() => {
    const steps = form.steps ?? []
    const water = steps.reduce((sum, s) => sum + (s.water ?? 0), 0)
    const time = steps.reduce((max, s) => Math.max(max, s.atTimeSec ?? 0), 0)
    return { water: water || undefined, time: time || undefined }
  }, [form.steps])

  const totalsMatch =
    stepTotals.water === form.yieldOut && stepTotals.time === form.totalTimeSec

  const tempDisplay = form.waterTemp == null ? '' : tempUnit === 'C' ? form.waterTemp : cToF(form.waterTemp)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const recipeId = await saveRecipe({
      title: form.title ?? '',
      method: form.method as BrewMethod,
      beanId: form.beanId,
      waterId: form.waterId,
      grinderId: form.grinderId,
      gearId: form.gearId,
      grindClicks: form.grindClicks,
      grindLabel: form.grindLabel,
      doseIn: form.doseIn,
      yieldOut: form.yieldOut,
      waterTemp: form.waterTemp,
      shotTimeSec: form.shotTimeSec,
      pressureBar: form.pressureBar,
      preInfusionSec: form.preInfusionSec,
      brewer: form.brewer,
      totalTimeSec: form.totalTimeSec,
      bloomSec: form.bloomSec,
      pours: form.pours,
      steps: form.steps,
      notes: form.notes,
      forkedFromId: form.forkedFromId,
      id: id ?? undefined,
    })

    // Log a brew session snapshot if the user rated/scored it.
    const scored =
      rating > 0 || Object.values(flavors).some(Boolean) || tags.length > 0 || tds !== '' || !!photo
    if (scored) {
      await saveSession({
        recipeId,
        beanId: form.beanId,
        waterId: form.waterId,
        grinderId: form.grinderId,
        date: Date.now(),
        method: form.method as BrewMethod,
        params: { ...form, id: undefined },
        rating,
        flavors,
        flavorTags: tags,
        tds: tds === '' ? undefined : Number(tds),
        beverageWeight: beverageWeight === '' ? undefined : Number(beverageWeight),
        photo,
        notes: form.notes,
      })
    }
    navigate(`/recipe/${recipeId}`)
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <PageHeader title={id ? t('common.edit') : t('home.newRecipe')} back />

      {/* method toggle */}
      <div className="grid grid-cols-2 gap-2">
        {(['espresso', 'brew'] as BrewMethod[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => set({ method: m })}
            className={`btn ${form.method === m ? 'bg-brand text-brand-fg' : 'btn-ghost'}`}
          >
            {t(`method.${m}`)}
          </button>
        ))}
      </div>

      <Field label={t('recipe.title')}>
        <input
          className="input"
          value={form.title ?? ''}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={isEspresso ? 'Morning shot' : 'V60 daily'}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('recipe.bean')} hint={t('common.optional')}>
          <select className="input" value={form.beanId ?? ''} onChange={(e) => set({ beanId: e.target.value || undefined })}>
            <option value="">{t('common.none')}</option>
            {beans?.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>
        <Field label={t('recipe.water')} hint={t('common.optional')}>
          <select className="input" value={form.waterId ?? ''} onChange={(e) => set({ waterId: e.target.value || undefined })}>
            <option value="">{t('common.none')}</option>
            {waters?.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* grinder + grind setting */}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('recipe.grinder')} hint={t('common.optional')}>
          <select className="input" value={form.grinderId ?? ''} onChange={(e) => set({ grinderId: e.target.value || undefined })}>
            <option value="">{t('common.none')}</option>
            {grinders?.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </Field>
        <Field label={`${t('recipe.grind')} (${t('recipe.clicks')})`}>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={form.grindClicks ?? ''}
            onChange={(e) => set({ grindClicks: num(e.target.value) })}
          />
        </Field>
      </div>
      <button type="button" className="text-sm font-medium text-brand" onClick={() => setShowConverter((v) => !v)}>
        {showConverter ? '▴' : '▾'} {t('grinder.convert')}
      </button>
      {showConverter && (
        <GrindConverter
          defaultToId={form.grinderId}
          onApply={(clicks, grinderId) => set({ grindClicks: clicks, grinderId })}
        />
      )}

      {/* dose */}
      <div className="grid grid-cols-3 items-end gap-3">
        <Field label={t('recipe.doseIn')}>
          <input className="input" type="number" inputMode="decimal" value={form.doseIn ?? ''} onChange={(e) => set({ doseIn: num(e.target.value) })} />
        </Field>
        <Field
          label={isEspresso ? t('recipe.yieldOut') : t('recipe.waterAmount')}
          hint={isEspresso ? t('recipe.yieldHint') : t('recipe.waterHint')}
        >
          <input className="input" type="number" inputMode="decimal" value={form.yieldOut ?? ''} onChange={(e) => set({ yieldOut: num(e.target.value) })} />
        </Field>
        <div className="pb-2 text-center">
          <span className="label">{t('recipe.ratio')}</span>
          <span className="text-lg font-semibold">{ratio ? `1:${ratio}` : '—'}</span>
        </div>
      </div>

      <Field label={`${t('recipe.waterTemp')} (°${tempUnit})`}>
        <input
          className="input"
          type="number"
          inputMode="decimal"
          value={tempDisplay}
          onChange={(e) => {
            const v = num(e.target.value)
            set({ waterTemp: v == null ? undefined : tempUnit === 'C' ? v : fToC(v) })
          }}
        />
      </Field>

      {/* method-specific */}
      {isEspresso ? (
        <div className="space-y-3">
        <Field label={t('gear.machine')} hint={t('common.optional')}>
          <select className="input" value={form.gearId ?? ''} onChange={(e) => set({ gearId: e.target.value || undefined })}>
            <option value="">{t('common.none')}</option>
            {gear?.filter((g) => g.type === 'machine').map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <InlineGearAdd type="machine" onAdded={(id) => set({ gearId: id })} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('recipe.shotTime')}>
            <input className="input" type="number" value={form.shotTimeSec ?? ''} onChange={(e) => set({ shotTimeSec: num(e.target.value) })} />
          </Field>
          <Field label={t('recipe.pressure')}>
            <input className="input" type="number" value={form.pressureBar ?? ''} onChange={(e) => set({ pressureBar: num(e.target.value) })} />
          </Field>
          <Field label={t('recipe.preInfusion')}>
            <input className="input" type="number" value={form.preInfusionSec ?? ''} onChange={(e) => set({ preInfusionSec: num(e.target.value) })} />
          </Field>
        </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('recipe.brewer')}>
              <select className="input" value={form.gearId ?? ''} onChange={(e) => set({ gearId: e.target.value || undefined })}>
                <option value="">{t('common.none')}</option>
                {gear?.filter((g) => g.type === 'brewer').map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <InlineGearAdd type="brewer" onAdded={(id) => set({ gearId: id })} />
            </Field>
            <Field label={t('recipe.totalTime')}>
              <ClockInput value={form.totalTimeSec} onChange={(secs) => set({ totalTimeSec: secs })} />
            </Field>
          </div>
          <div>
            <span className="label">{t('recipe.steps')}</span>
            <BrewSteps value={form.steps ?? []} onChange={(steps) => set({ steps })} />
            {(stepTotals.water || stepTotals.time) && !totalsMatch && (
              <button
                type="button"
                className="btn-ghost mt-2 w-full !py-1.5 text-sm"
                onClick={() => set({ yieldOut: stepTotals.water, totalTimeSec: stepTotals.time })}
              >
                {t('recipe.applyTotals', {
                  water: stepTotals.water ?? 0,
                  time: stepTotals.time ? formatSeconds(stepTotals.time) : '—',
                })}
              </button>
            )}
          </div>
        </div>
      )}

      <BrewTimer onUse={(s) => set(isEspresso ? { shotTimeSec: s } : { totalTimeSec: s })} />

      {/* tasting */}
      <section className="card space-y-4 p-4">
        <h2 className="font-semibold">{t('session.flavors')}</h2>
        <div>
          <span className="label">{t('session.rating')}</span>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <ScoreSlider label={t('session.acidity')} value={flavors.acidity} onChange={(v) => setFlavors((f) => ({ ...f, acidity: v }))} />
        <ScoreSlider label={t('session.body')} value={flavors.body} onChange={(v) => setFlavors((f) => ({ ...f, body: v }))} />
        <ScoreSlider label={t('session.sweetness')} value={flavors.sweetness} onChange={(v) => setFlavors((f) => ({ ...f, sweetness: v }))} />
        <ScoreSlider label={t('session.bitterness')} value={flavors.bitterness} onChange={(v) => setFlavors((f) => ({ ...f, bitterness: v }))} />
        <div>
          <span className="label">{t('session.tags')}</span>
          <FlavorWheel value={tags} onChange={setTags} />
          <div className="mt-2">
            <TagInput value={tags} onChange={setTags} placeholder={t('session.addTag')} />
          </div>
        </div>
        <div className="border-t border-border/60 pt-3">
          <p className="text-xs text-muted">{t('session.measuredHint')}</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Field label={t('session.tds')} hint={t('common.optional')}>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={tds}
                onChange={(e) => setTds(e.target.value)}
                placeholder={isEspresso ? '10' : '1.35'}
              />
            </Field>
            <Field label={t('session.beverageWeight')} hint={t('common.optional')}>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                value={beverageWeight}
                onChange={(e) => setBeverageWeight(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <div className="border-t border-border/60 pt-3">
          <span className="label">{t('session.photo')}</span>
          <PhotoInput value={photo} onChange={setPhoto} />
        </div>
      </section>

      <Field label={t('recipe.notes')}>
        <textarea className="input min-h-24" value={form.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
      </Field>

      <div className="sticky bottom-20 flex gap-2">
        <button type="submit" className="btn-primary flex-1">{t('common.save')}</button>
      </div>
    </form>
  )
}
