import { useTranslation } from 'react-i18next'
import type { Recipe } from '@/db/types'
import { useSettings } from '@/store/settings'
import { formatSeconds, formatTemp } from '@/lib/units'

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between border-b border-border/60 py-1.5 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

/** The shareable recipe card (also rendered to PNG). */
export function RecipeCard({ recipe, beanName }: { recipe: Recipe; beanName?: string }) {
  const { t } = useTranslation()
  const unit = useSettings((s) => s.tempUnit)
  const isEspresso = recipe.method === 'espresso'

  return (
    <div className="card overflow-hidden">
      <div className="bg-brand px-4 py-3 text-brand-fg">
        <p className="text-xs uppercase tracking-wide opacity-80">{t('method.' + recipe.method)}</p>
        <h2 className="text-xl font-bold">{recipe.title || t('method.' + recipe.method)}</h2>
        {beanName && <p className="text-sm opacity-90">{beanName}</p>}
      </div>
      <div className="px-4 py-2">
        <Row label={t('recipe.ratio')} value={recipe.ratio ? `1:${recipe.ratio}` : null} />
        <Row label={t('recipe.doseIn')} value={recipe.doseIn} />
        <Row label={isEspresso ? t('recipe.yieldOut') : t('recipe.waterAmount')} value={recipe.yieldOut} />
        <Row label={t('recipe.grind')} value={recipe.grindClicks ?? recipe.grindLabel} />
        <Row label={t('recipe.waterTemp')} value={recipe.waterTemp != null ? formatTemp(recipe.waterTemp, unit) : null} />
        {isEspresso ? (
          <>
            <Row label={t('recipe.shotTime')} value={formatSeconds(recipe.shotTimeSec)} />
            <Row label={t('recipe.pressure')} value={recipe.pressureBar} />
            <Row label={t('recipe.preInfusion')} value={recipe.preInfusionSec} />
          </>
        ) : (
          <>
            <Row label={t('recipe.brewer')} value={recipe.brewer} />
            <Row label={t('recipe.totalTime')} value={formatSeconds(recipe.totalTimeSec)} />
            <Row label={t('recipe.bloom')} value={recipe.bloomSec} />
            <Row label={t('recipe.pours')} value={recipe.pours} />
          </>
        )}
        {recipe.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{recipe.notes}</p>}
      </div>
      <p className="px-4 pb-2 text-right text-[10px] text-muted">Barista Log</p>
    </div>
  )
}
