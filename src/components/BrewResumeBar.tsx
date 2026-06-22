import { useEffect, useReducer } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Coffee, X } from 'lucide-react'
import { db } from '@/db/dexie'
import { useBrewPlayer, elapsedSec } from '@/store/brewPlayer'
import { formatSeconds } from '@/lib/units'

/**
 * Floating "resume brew" pill shown on every screen while a brew is open, so an
 * accidental tap away from the player never loses it. Hidden on the player page
 * itself. Tapping returns to the brew; the × closes it.
 */
export function BrewResumeBar() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const player = useBrewPlayer()
  const recipe = useLiveQuery(
    () => (player.recipeId ? db.recipes.get(player.recipeId) : undefined),
    [player.recipeId],
  )

  // Tick while running so the elapsed readout stays live.
  const [, tick] = useReducer((c) => c + 1, 0)
  useEffect(() => {
    if (!player.running) return
    const iv = window.setInterval(tick, 500)
    return () => window.clearInterval(iv)
  }, [player.running])

  if (!player.recipeId) return null
  if (pathname === `/recipe/${player.recipeId}/brew`) return null

  const elapsed = elapsedSec(player)

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.75rem)] z-30 px-4">
      <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-xl border border-brand/40 bg-surface/95 p-2 pl-3 shadow-lg backdrop-blur">
        <Link to={`/recipe/${player.recipeId}/brew`} className="flex min-w-0 flex-1 items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {player.running && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60" />
            )}
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
          </span>
          <Coffee size={16} className="shrink-0 text-brand" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {recipe?.title || t('play.title')}
          </span>
          <span className="shrink-0 font-mono text-sm tabular-nums text-brand">
            {formatSeconds(elapsed)}
          </span>
        </Link>
        <Link
          to={`/recipe/${player.recipeId}/brew`}
          className="shrink-0 rounded-lg bg-brand px-3 py-1 text-sm font-medium text-brand-fg"
        >
          {t('play.resume')}
        </Link>
        <button
          onClick={() => {
            if (elapsedSec(player) === 0 || confirm(t('play.discardConfirm'))) player.close()
          }}
          className="shrink-0 text-muted hover:text-red-500"
          aria-label={t('play.discard')}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
