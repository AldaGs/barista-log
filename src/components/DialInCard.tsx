import { useTranslation } from 'react-i18next'
import { Target, AlertTriangle, Lightbulb, CheckCircle2, ChevronDown, ChevronUp, Thermometer } from 'lucide-react'
import type { BrewSession, Recipe } from '@/db/types'
import { dialIn } from '@/lib/dialIn'
import type { InsightTone } from '@/lib/insights'

const TONE: Record<InsightTone, { icon: typeof Lightbulb; cls: string }> = {
  warn: { icon: AlertTriangle, cls: 'text-amber-600 dark:text-amber-400' },
  tip: { icon: Lightbulb, cls: 'text-brand' },
  good: { icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400' },
}

/**
 * Espresso-only "what next?" card. Reads the most recent logged shot and
 * suggests the next grind/temperature move (see lib/dialIn). When nothing is
 * logged yet it nudges the user to pull and log a shot so the loop can start.
 */
export function DialInCard({
  recipe,
  lastSession,
  micronsPerClick,
}: {
  recipe: Partial<Recipe>
  lastSession?: BrewSession
  micronsPerClick?: number
}) {
  const { t } = useTranslation()
  if (recipe.method !== 'espresso') return null

  const result = dialIn(recipe, lastSession, micronsPerClick)

  return (
    <section className="card space-y-2 p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Target size={16} className="text-brand" /> {t('dialIn.title')}
      </h2>

      {!result ? (
        <p className="text-sm text-muted">{t('dialIn.empty')}</p>
      ) : (
        <>
          {(() => {
            const { icon: Icon, cls } = TONE[result.move.tone]
            return (
              <p className="flex items-start gap-2 text-sm">
                <Icon size={16} className={`mt-0.5 shrink-0 ${cls}`} />
                <span>{t(`dialIn.${result.move.key}`, result.move.vars)}</span>
              </p>
            )
          })()}

          {(result.move.grind !== 'hold' || result.move.temp) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {result.move.grind !== 'hold' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
                  {result.move.grind === 'finer' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  {result.move.clicks
                    ? t(`dialIn.grind.${result.move.grind}Clicks`, { clicks: result.move.clicks })
                    : t(`dialIn.grind.${result.move.grind}`)}
                </span>
              )}
              {result.move.temp && (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted ring-1 ring-border">
                  <Thermometer size={14} />
                  {t(`dialIn.temp.${result.move.temp}`)}
                </span>
              )}
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-muted">{t('dialIn.disclaimer')}</p>
    </section>
  )
}
