import { useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Copy, Trash2, Share2, Play, Check, GitFork } from 'lucide-react'
import { db } from '@/db/dexie'
import { deleteRecipe } from '@/db/repo'
import { PageHeader } from '@/components/ui'
import { RecipeCard } from './RecipeCard'
import { BrewChart } from '@/components/BrewChart'
import { estimateBrew, measuredBrew, type BrewPoint } from '@/lib/brewModel'
import { shareRecipePng } from '@/lib/share'

export default function RecipeDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const cardRef = useRef<HTMLDivElement>(null)

  const recipe = useLiveQuery(() => (id ? db.recipes.get(id) : undefined), [id])
  const bean = useLiveQuery(
    () => (recipe?.beanId ? db.beans.get(recipe.beanId) : undefined),
    [recipe?.beanId],
  )
  const gear = useLiveQuery(
    () => (recipe?.gearId ? db.gear.get(recipe.gearId) : undefined),
    [recipe?.gearId],
  )
  const parent = useLiveQuery(
    () => (recipe?.forkedFromId ? db.recipes.get(recipe.forkedFromId) : undefined),
    [recipe?.forkedFromId],
  )
  const grinder = useLiveQuery(
    () => (recipe?.grinderId ? db.grinders.get(recipe.grinderId) : undefined),
    [recipe?.grinderId],
  )
  const sessions = useLiveQuery(
    () => (id ? db.sessions.where('recipeId').equals(id).toArray() : []),
    [id],
  )

  if (recipe === undefined) return null
  if (!recipe) return <p className="text-muted">Not found.</p>

  // Brew control chart: estimated point from params + any measured (TDS) points.
  const estimate = estimateBrew(recipe, grinder?.micronsPerClick)
  const measured = (sessions ?? [])
    .slice()
    .sort((a, b) => a.date - b.date)
    .map((s, i, arr) => {
      const point = measuredBrew(s)
      return point ? { point, weight: arr.length > 1 ? i / (arr.length - 1) : 1 } : null
    })
    .filter((x): x is { point: BrewPoint; weight: number } => x !== null)
  const tdsFmt = (v: number) => (recipe.method === 'espresso' ? v.toFixed(1) : v.toFixed(2))

  return (
    <div className="space-y-4">
      <PageHeader
        title={recipe.title || t('method.' + recipe.method)}
        back
        action={
          <div className="flex gap-1">
            <Link to={`/recipe/${recipe.id}/edit`} className="btn-ghost !px-2" aria-label="edit">
              <Pencil size={18} />
            </Link>
            <Link to={`/recipe/new?fork=${recipe.id}`} className="btn-ghost !px-2" aria-label="fork">
              <GitFork size={18} />
            </Link>
            <Link to={`/recipe/new?from=${recipe.id}`} className="btn-ghost !px-2" aria-label="duplicate">
              <Copy size={18} />
            </Link>
          </div>
        }
      />

      {parent && (
        <Link
          to={`/recipe/${parent.id}`}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-brand"
        >
          <GitFork size={14} /> {t('recipe.forkedFrom', { title: parent.title || t('method.' + parent.method) })}
        </Link>
      )}

      {recipe.method === 'brew' && recipe.steps && recipe.steps.length > 0 ? (
        <div className="flex gap-2">
          <Link to={`/recipe/${recipe.id}/brew`} className="btn-primary flex-1">
            <Play size={18} /> {t('play.title')}
          </Link>
          <Link to={`/recipe/${recipe.id}/log`} className="btn-ghost flex-1">
            <Check size={18} /> {t('session.logBrew')}
          </Link>
        </div>
      ) : (
        <Link to={`/recipe/${recipe.id}/log`} className="btn-ghost w-full">
          <Check size={18} /> {t('session.logBrew')}
        </Link>
      )}

      <div ref={cardRef}>
        <RecipeCard recipe={recipe} beanName={bean?.name} gearName={gear?.name} />
      </div>

      {(estimate || measured.length > 0) && (
        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t('chart.title')}</h2>
          </div>
          <BrewChart method={recipe.method} estimate={estimate} measured={measured} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {estimate && (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-brand bg-surface" />
                {t('chart.estimated')}
              </span>
            )}
            {measured.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-accent" />
                {t('chart.measured')}
              </span>
            )}
          </div>
          {estimate && (
            <p className="text-xs text-muted">
              {t('chart.readout', { ext: estimate.extraction.toFixed(1), tds: tdsFmt(estimate.tds) })}
            </p>
          )}
          <p className="text-[11px] text-muted/70">{t('chart.disclaimer')}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          className="btn-ghost flex-1"
          onClick={() => shareRecipePng(cardRef.current, recipe.title || 'recipe')}
        >
          <Share2 size={18} /> {t('common.share')}
        </button>
        <button
          className="btn-ghost text-red-500"
          onClick={async () => {
            await deleteRecipe(recipe.id)
            navigate('/')
          }}
        >
          <Trash2 size={18} /> {t('common.delete')}
        </button>
      </div>
    </div>
  )
}
