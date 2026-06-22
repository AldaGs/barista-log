import { useEffect, useReducer } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { Snowflake, X } from 'lucide-react'
import { db } from '@/db/dexie'
import { useColdSteep, steepProgress, steepReadyAt } from '@/store/coldSteep'

/**
 * Persistent "cold brewing" pill shown on every screen while a steep is running.
 * Unlike the brew player it's a long wall-clock countdown to a *ready* moment, so
 * it shows a progress fill and the ready time rather than a live second counter.
 * This is the iOS-friendly stand-in for a notification: an installed PWA can't
 * fire Web Notifications reliably, but this pill is always visible when the app
 * is open, and the steep survives reloads/closes (pure wall-clock).
 */
export function ColdSteepBar() {
  const { t } = useTranslation()
  const steep = useColdSteep()
  const recipe = useLiveQuery(
    () => (steep.recipeId ? db.recipes.get(steep.recipeId) : undefined),
    [steep.recipeId],
  )

  // Tick once a minute to advance the progress fill / ready countdown.
  const [, tick] = useReducer((c) => c + 1, 0)
  useEffect(() => {
    if (!steep.recipeId) return
    const iv = window.setInterval(tick, 60_000)
    return () => window.clearInterval(iv)
  }, [steep.recipeId])

  if (!steep.recipeId) return null

  const progress = steepProgress(steep)
  const readyAt = steepReadyAt(steep)
  const done = progress >= 1
  // Sit just above the brew-resume slot so the two never overlap.
  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-30 px-4">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-sky-400/40 bg-surface/95 shadow-lg backdrop-blur">
        <div className="flex items-center gap-3 p-2 pl-3">
          <Snowflake size={16} className={`shrink-0 text-sky-500 ${!done ? 'animate-pulse' : ''}`} />
          <Link
            to={steep.recipeId ? `/recipe/${steep.recipeId}/log` : '#'}
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {recipe?.title || t('coldbrew.steeping')}
            </span>
            <span className="shrink-0 text-xs text-sky-600 dark:text-sky-400">
              {done || readyAt == null
                ? t('coldbrew.readyNow')
                : t('coldbrew.ready', { time: format(readyAt, 'EEE HH:mm') })}
            </span>
          </Link>
          <button
            onClick={() => steep.stop()}
            className="shrink-0 text-muted hover:text-red-500"
            aria-label={t('coldbrew.stopSteep')}
          >
            <X size={18} />
          </button>
        </div>
        {/* progress fill */}
        <div className="h-1 bg-sky-400/15">
          <div
            className="h-full bg-sky-500 transition-[width] duration-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
