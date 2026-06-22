import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/dexie'
import { PageHeader, EmptyState } from '@/components/ui'
import { useSettings } from '@/store/settings'
import { buildRecipeDrill } from '@/lib/pourDrill'
import { DrillRunner } from './DrillRunner'

/** Replay a saved recipe's pour timeline as a practice drill (no logging). */
export default function PracticePage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const pourRates = useSettings((s) => s.pourRates)
  const recipe = useLiveQuery(() => (id ? db.recipes.get(id) : undefined), [id])
  const [metronome, setMetronome] = useState(true)

  const segments = useMemo(
    () => (recipe ? buildRecipeDrill(recipe, pourRates) : []),
    [recipe, pourRates],
  )

  if (recipe === undefined) return null
  if (!recipe) return <p className="text-muted">{t('common.notFound')}</p>

  return (
    <div className="space-y-5">
      <PageHeader title={t('gym.practiceTitle', { title: recipe.title || t('method.' + recipe.method) })} back />

      {segments.length === 0 ? (
        <EmptyState>{t('gym.noPours')}</EmptyState>
      ) : (
        <>
          <DrillRunner segments={segments} metronome={metronome} />
          <label className="card flex items-center justify-between p-4">
            <span className="text-sm">{t('gym.metronome')}</span>
            <input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={metronome} onChange={(e) => setMetronome(e.target.checked)} />
          </label>
        </>
      )}
    </div>
  )
}
