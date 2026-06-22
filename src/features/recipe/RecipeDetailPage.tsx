import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { Pencil, Copy, Trash2, Share2, Play, Check, GitFork, AlertTriangle, Send, Star, GitCompare, Snowflake, X } from 'lucide-react'
import { db } from '@/db/dexie'
import { deleteRecipe, toggleFavorite } from '@/db/repo'
import { useColdSteep } from '@/store/coldSteep'
import { PageHeader } from '@/components/ui'
import { RecipeCard } from './RecipeCard'
import { BrewChart } from '@/components/BrewChart'
import { RecipeInsights } from '@/components/RecipeInsights'
import { estimateBrew, measuredBrew, type BrewPoint } from '@/lib/brewModel'
import { formatSeconds } from '@/lib/units'
import { freshness } from '@/lib/freshness'
import { shareRecipePng } from '@/lib/share'
import { ShareRecipeSheet } from './ShareRecipeSheet'

export default function RecipeDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const cardRef = useRef<HTMLDivElement>(null)
  const [showShare, setShowShare] = useState(false)

  const steep = useColdSteep()
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

  const log = (sessions ?? []).slice().sort((a, b) => b.date - a.date)

  const beanFresh = bean ? freshness(bean) : null
  const restingDaysLeft = beanFresh ? Math.max(beanFresh.restDays - (beanFresh.ageDays ?? 0), 0) : 0

  return (
    <div className="space-y-4">
      <PageHeader
        title={recipe.title || t('method.' + recipe.method)}
        back
        action={
          <div className="flex gap-1">
            <button
              onClick={() => toggleFavorite(recipe.id)}
              className={`btn-ghost !px-2 ${recipe.favorite ? 'text-brand' : ''}`}
              aria-label={recipe.favorite ? t('recipes.unpin') : t('recipes.pin')}
              aria-pressed={!!recipe.favorite}
            >
              <Star size={18} fill={recipe.favorite ? 'currentColor' : 'none'} />
            </button>
            <button onClick={() => setShowShare(true)} className="btn-ghost !px-2" aria-label={t('share.recipeTitle')}>
              <Send size={18} />
            </button>
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

      {beanFresh?.status === 'resting' && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/15 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{t('beans.tooFresh', { name: bean?.name, count: restingDaysLeft })}</span>
        </div>
      )}

      {(() => {
        const isSteep = recipe.method === 'coldbrew' && recipe.coldBrewStyle !== 'flash'
        // brew and flash both run the guided second-clock player.
        const guided =
          !isSteep && recipe.steps && recipe.steps.length > 0 &&
          (recipe.method === 'brew' || recipe.method === 'coldbrew')
        const logBtn = (
          <Link to={`/recipe/${recipe.id}/log`} className="btn-ghost flex-1">
            <Check size={18} /> {t('session.logBrew')}
          </Link>
        )

        if (isSteep) {
          const active = steep.recipeId === recipe.id
          return (
            <div className="flex gap-2">
              {active ? (
                <button onClick={() => steep.stop()} className="btn-ghost flex-1">
                  <X size={18} /> {t('coldbrew.stopSteep')}
                </button>
              ) : (
                <button
                  onClick={() => steep.begin(recipe.id, recipe.steepHours || 16)}
                  className="btn-primary flex-1"
                >
                  <Snowflake size={18} /> {t('coldbrew.startSteep')}
                </button>
              )}
              {logBtn}
            </div>
          )
        }
        if (guided) {
          return (
            <div className="flex gap-2">
              <Link to={`/recipe/${recipe.id}/brew`} className="btn-primary flex-1">
                <Play size={18} /> {t('play.title')}
              </Link>
              {logBtn}
            </div>
          )
        }
        return (
          <Link to={`/recipe/${recipe.id}/log`} className="btn-ghost w-full">
            <Check size={18} /> {t('session.logBrew')}
          </Link>
        )
      })()}

      <div ref={cardRef}>
        <RecipeCard recipe={recipe} beanName={bean?.name} gearName={gear?.name} micronsPerClick={grinder?.micronsPerClick} />
      </div>

      <RecipeInsights recipe={recipe} micronsPerClick={grinder?.micronsPerClick} />

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

      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('recipe.log.title')}</h2>
          {log.length > 0 && (
            <span className="text-xs text-muted">{t('recipe.log.count', { count: log.length })}</span>
          )}
        </div>
        {log.length === 0 ? (
          <p className="text-sm text-muted">{t('recipe.log.empty')}</p>
        ) : (
          <>
            <ol className="space-y-2">
              {log.map((s) => (
                <li key={s.id} className="rounded-xl border border-border/60 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium tabular-nums">{format(s.date, 'PPp')}</span>
                    {s.rating ? (
                      <span className="inline-flex items-center gap-1 text-sm text-brand">
                        <Star size={14} fill="currentColor" /> {s.rating}
                      </span>
                    ) : null}
                  </div>
                  {(s.tds != null || s.beverageWeight != null || s.actualTotalSec != null) && (
                    <p className="mt-1 text-xs tabular-nums text-muted">
                      {[
                        s.actualTotalSec != null
                          ? t('history.actualValue', { value: formatSeconds(s.actualTotalSec) })
                          : null,
                        s.tds != null ? t('history.tdsValue', { value: tdsFmt(s.tds) }) : null,
                        s.beverageWeight != null ? t('history.bevValue', { value: s.beverageWeight }) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  {s.flavorTags && s.flavorTags.length > 0 && (
                    <p className="mt-1 text-xs text-muted">{s.flavorTags.join(', ')}</p>
                  )}
                  {s.notes?.trim() && (
                    <p className="mt-1 whitespace-pre-wrap text-xs italic text-muted">{s.notes}</p>
                  )}
                </li>
              ))}
            </ol>
            <Link to="/history" className="inline-flex items-center gap-1.5 text-sm text-brand">
              <GitCompare size={16} /> {t('recipe.log.viewAll')}
            </Link>
          </>
        )}
      </div>

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

      {showShare && <ShareRecipeSheet recipe={recipe} onClose={() => setShowShare(false)} />}
    </div>
  )
}
