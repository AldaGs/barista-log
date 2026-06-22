import { useTranslation } from 'react-i18next'
import { Lightbulb, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Recipe } from '@/db/types'
import type { Freshness } from '@/lib/freshness'
import { useSettings } from '@/store/settings'
import { buildInsights, type InsightTone } from '@/lib/insights'

const TONE: Record<InsightTone, { icon: typeof Lightbulb; cls: string }> = {
  warn: { icon: AlertTriangle, cls: 'text-amber-600 dark:text-amber-400' },
  tip: { icon: Lightbulb, cls: 'text-brand' },
  good: { icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400' },
}

/**
 * Read-only suggestion panel derived from the recipe's own numbers. Renders
 * nothing when there's not enough entered to say anything useful.
 */
export function RecipeInsights({
  recipe,
  micronsPerClick,
  freshness,
}: {
  recipe: Partial<Recipe>
  micronsPerClick?: number
  freshness?: Freshness
}) {
  const { t } = useTranslation()
  const tempUnit = useSettings((s) => s.tempUnit)
  const insights = buildInsights(recipe, { micronsPerClick, tempUnit, freshness })
  if (insights.length === 0) return null

  return (
    <section className="card space-y-2 p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Lightbulb size={16} className="text-brand" /> {t('insights.title')}
      </h2>
      <ul className="space-y-2">
        {insights.map((ins) => {
          const { icon: Icon, cls } = TONE[ins.tone]
          return (
            <li key={ins.id} className="flex items-start gap-2 text-sm">
              <Icon size={16} className={`mt-0.5 shrink-0 ${cls}`} />
              <span>{t(`insights.${ins.key}`, ins.vars)}</span>
            </li>
          )
        })}
      </ul>
      <p className="text-[11px] text-muted">{t('insights.disclaimer')}</p>
    </section>
  )
}
