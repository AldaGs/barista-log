import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Coffee, Droplets, Timer, Star } from 'lucide-react'
import type { Recipe } from '@/db/types'
import { db } from '@/db/dexie'
import { toggleFavorite } from '@/db/repo'
import { useSettings } from '@/store/settings'
import { formatSeconds, formatTemp } from '@/lib/units'

export function RecipeSummaryCard({
  recipe,
  featured,
  index = 0,
}: {
  recipe: Recipe
  featured?: boolean
  /** position in a list — drives a small staggered entrance delay */
  index?: number
}) {
  const { t } = useTranslation()
  const tempUnit = useSettings((s) => s.tempUnit)
  const bean = useLiveQuery(
    () => (recipe.beanId ? db.beans.get(recipe.beanId) : undefined),
    [recipe.beanId],
  )
  const isSteep = recipe.method === 'coldbrew' && recipe.coldBrewStyle !== 'flash'
  const time = recipe.method === 'espresso' ? recipe.shotTimeSec : recipe.totalTimeSec

  return (
    <Link
      to={`/recipe/${recipe.id}`}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      className={`rise card block p-4 transition hover:border-brand ${featured ? 'ring-1 ring-brand/30' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{recipe.title || t('method.' + recipe.method)}</h3>
          {bean && <p className="text-sm text-muted">{bean.name}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="chip capitalize">{t('method.' + recipe.method)}</span>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleFavorite(recipe.id)
            }}
            className={recipe.favorite ? 'text-brand' : 'text-muted hover:text-brand'}
            aria-label={recipe.favorite ? t('recipes.unpin') : t('recipes.pin')}
            aria-pressed={!!recipe.favorite}
          >
            <Star size={18} fill={recipe.favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
      <div className="metric mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        {recipe.ratio && (
          <span className="inline-flex items-center gap-1">
            <Coffee size={15} /> 1:{recipe.ratio}
          </span>
        )}
        {recipe.doseIn && (
          <span className="inline-flex items-center gap-1">
            <Droplets size={15} /> {recipe.doseIn}g → {recipe.yieldOut ?? '—'}g
          </span>
        )}
        {isSteep && recipe.steepHours != null ? (
          <span className="inline-flex items-center gap-1">
            <Timer size={15} /> {recipe.steepHours}h
          </span>
        ) : time != null ? (
          <span className="inline-flex items-center gap-1">
            <Timer size={15} /> {formatSeconds(time)}
          </span>
        ) : null}
        {recipe.waterTemp != null && <span>{formatTemp(recipe.waterTemp, tempUnit)}</span>}
      </div>
    </Link>
  )
}
