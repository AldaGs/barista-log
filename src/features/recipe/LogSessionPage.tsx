import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/dexie'
import { saveSession } from '@/db/repo'
import { PageHeader, Field, StarRating, ScoreSlider } from '@/components/ui'
import { TagInput } from '@/components/TagInput'

/** Hand-off target from the guided brew player: rate & log a session. */
export default function LogSessionPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const recipe = useLiveQuery(() => (id ? db.recipes.get(id) : undefined), [id])
  const bean = useLiveQuery(
    () => (recipe?.beanId ? db.beans.get(recipe.beanId) : undefined),
    [recipe?.beanId],
  )

  const [rating, setRating] = useState(0)
  const [flavors, setFlavors] = useState({ acidity: 0, body: 0, sweetness: 0, bitterness: 0 })
  const [tags, setTags] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [tds, setTds] = useState('')
  const [beverageWeight, setBeverageWeight] = useState('')

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
      date: Date.now(),
      method: recipe.method,
      params: { ...recipe, id: undefined },
      rating,
      flavors,
      flavorTags: tags,
      tds: tds === '' ? undefined : Number(tds),
      beverageWeight: beverageWeight === '' ? undefined : Number(beverageWeight),
      notes,
    })
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
          <TagInput value={tags} onChange={setTags} placeholder={t('session.addTag')} />
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

      <Field label={t('recipe.notes')}>
        <textarea className="input min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <button type="submit" className="btn-primary w-full">{t('common.save')}</button>
    </form>
  )
}
