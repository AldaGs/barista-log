import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/dexie'
import { saveSession } from '@/db/repo'
import { PageHeader, Field, StarRating, ScoreSlider } from '@/components/ui'
import { TagInput } from '@/components/TagInput'
import { FlavorWheel } from '@/components/FlavorWheel'
import { PhotoInput } from '@/components/PhotoInput'
import { formatSeconds } from '@/lib/units'
import { useBrewPlayer } from '@/store/brewPlayer'

/** Actual timeline handed over from the guided brew player via router state. */
interface BrewActual {
  actualTotalSec?: number
  actualLaps?: number[]
}

/** Epoch ms → `YYYY-MM-DDTHH:mm` in the device's local timezone, for datetime-local inputs. */
function toLocalInput(ms: number) {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Signed mm:ss delta, e.g. +0:12 / −0:05 / on time. */
function deltaLabel(deltaSec: number): string {
  if (deltaSec === 0) return '±0:00'
  const sign = deltaSec > 0 ? '+' : '−'
  return sign + formatSeconds(Math.abs(deltaSec))
}

/** Hand-off target from the guided brew player: rate & log a session. */
export default function LogSessionPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const actual = (useLocation().state ?? {}) as BrewActual
  const closeBrew = useBrewPlayer((s) => s.close)
  const activeRecipeId = useBrewPlayer((s) => s.recipeId)
  const recipe = useLiveQuery(() => (id ? db.recipes.get(id) : undefined), [id])
  const bean = useLiveQuery(
    () => (recipe?.beanId ? db.beans.get(recipe.beanId) : undefined),
    [recipe?.beanId],
  )

  const [when, setWhen] = useState(() => toLocalInput(Date.now()))
  const [rating, setRating] = useState(0)
  const [flavors, setFlavors] = useState({ acidity: 0, body: 0, sweetness: 0, bitterness: 0 })
  const [tags, setTags] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [tds, setTds] = useState('')
  const [beverageWeight, setBeverageWeight] = useState('')
  const [photo, setPhoto] = useState<Blob | undefined>()

  if (recipe === undefined) return null
  if (!recipe) return <p className="text-muted">Not found.</p>

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!recipe) return
    await saveSession({
      recipeId: recipe.id,
      beanId: recipe.beanId,
      waterId: recipe.waterId,
      grinderId: recipe.grinderId,
      date: when ? new Date(when).getTime() : Date.now(),
      method: recipe.method,
      params: { ...recipe, id: undefined },
      rating,
      flavors,
      flavorTags: tags,
      tds: tds === '' ? undefined : Number(tds),
      beverageWeight: beverageWeight === '' ? undefined : Number(beverageWeight),
      actualTotalSec: actual.actualTotalSec,
      actualLaps: actual.actualLaps?.length ? actual.actualLaps : undefined,
      photo,
      notes,
    })
    // The brew is now recorded — tear down the persistent player session.
    if (activeRecipeId === recipe.id) closeBrew()
    navigate('/history')
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <PageHeader title={t('session.logBrew')} back />

      <div className="card p-4">
        <p className="font-semibold">{recipe.title || t('method.' + recipe.method)}</p>
        <p className="text-sm text-muted">
          {[bean?.name, recipe.ratio ? `1:${recipe.ratio}` : null].filter(Boolean).join(' · ')}
        </p>
      </div>

      {actual.actualTotalSec != null && (
        <div className="card space-y-1 p-4">
          <h2 className="font-semibold">{t('session.actualTitle')}</h2>
          <p className="text-2xl font-bold tabular-nums text-brand">
            {formatSeconds(actual.actualTotalSec)}
            {recipe.totalTimeSec ? (
              <span className="ml-2 text-sm font-medium text-muted">
                {t('session.vsPlan', {
                  plan: formatSeconds(recipe.totalTimeSec),
                  delta: deltaLabel(actual.actualTotalSec - recipe.totalTimeSec),
                })}
              </span>
            ) : null}
          </p>
          {actual.actualLaps?.length ? (
            <p className="text-xs tabular-nums text-muted">
              {t('session.marks')}: {actual.actualLaps.map((l) => formatSeconds(l)).join(' · ')}
            </p>
          ) : null}
        </div>
      )}

      <Field label={t('session.when')}>
        <input
          className="input"
          type="datetime-local"
          value={when}
          max={toLocalInput(Date.now())}
          onChange={(e) => setWhen(e.target.value)}
        />
      </Field>

      <section className="card space-y-4 p-4">
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
      </section>

      <section className="card space-y-3 p-4">
        <div>
          <h2 className="font-semibold">{t('session.measured')}</h2>
          <p className="text-xs text-muted">{t('session.measuredHint')}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('session.tds')} hint={t('common.optional')}>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={tds}
              onChange={(e) => setTds(e.target.value)}
              placeholder={recipe.method === 'espresso' ? '10' : '1.35'}
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
      </section>

      <div>
        <span className="label">{t('session.photo')}</span>
        <PhotoInput value={photo} onChange={setPhoto} />
      </div>

      <Field label={t('recipe.notes')}>
        <textarea className="input min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <button type="submit" className="btn-primary w-full">{t('common.save')}</button>
    </form>
  )
}
