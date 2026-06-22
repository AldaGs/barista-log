import { useTranslation } from 'react-i18next'
import type { Recipe } from '@/db/types'
import { useSettings } from '@/store/settings'
import { formatSeconds, formatTemp } from '@/lib/units'
import { estimateMicrons } from '@/lib/grindConvert'

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
export function RecipeCard({
  recipe,
  beanName,
  gearName,
  micronsPerClick,
}: {
  recipe: Recipe
  beanName?: string
  gearName?: string
  /** µm/click of the recipe's grinder, to show an estimated grind size */
  micronsPerClick?: number
}) {
  const { t } = useTranslation()
  const unit = useSettings((s) => s.tempUnit)
  const microns = estimateMicrons(recipe.grindClicks, micronsPerClick)
  const isEspresso = recipe.method === 'espresso'
  const isCold = recipe.method === 'coldbrew'
  // Flash (iced) is hot-brewed onto ice, so it keeps the brew pour schedule;
  // immersion & slow-drip use a steep duration instead.
  const isFlash = isCold && recipe.coldBrewStyle === 'flash'
  const isSteep = isCold && !isFlash
  const bloom = recipe.hotBloom

  return (
    <div className="card overflow-hidden">
      <div className="bg-brand px-4 py-3 text-brand-fg">
        <p className="text-xs uppercase tracking-wide opacity-80">{t('method.' + recipe.method)}</p>
        <h2 className="text-xl font-bold">{recipe.title || t('method.' + recipe.method)}</h2>
        {beanName && <p className="text-sm opacity-90">{beanName}</p>}
      </div>
      <div className="px-4 py-2">
        <Row
          label={t('recipe.ratio')}
          value={recipe.ratio ? `1:${recipe.ratio}${isSteep && recipe.concentrate ? ` · ${t('coldbrew.concentrate')}` : ''}` : null}
        />
        <Row label={t('recipe.doseIn')} value={recipe.doseIn} />
        <Row label={isEspresso ? t('recipe.yieldOut') : t('recipe.waterAmount')} value={recipe.yieldOut} />
        <Row
          label={t('recipe.grind')}
          value={
            recipe.grindClicks != null
              ? `${recipe.grindClicks}${microns != null ? ` · ${t('grinder.microns', { microns })}` : ''}`
              : recipe.grindLabel
          }
        />
        {/* immersion/slow-drip use cold water; only the optional bloom is hot */}
        {!isSteep && (
          <Row label={t('recipe.waterTemp')} value={recipe.waterTemp != null ? formatTemp(recipe.waterTemp, unit) : null} />
        )}
        {isEspresso ? (
          <>
            <Row label={t('gear.machine')} value={gearName} />
            <Row label={t('recipe.shotTime')} value={formatSeconds(recipe.shotTimeSec)} />
            <Row label={t('recipe.pressure')} value={recipe.pressureBar} />
            <Row label={t('recipe.preInfusion')} value={recipe.preInfusionSec} />
          </>
        ) : isSteep ? (
          <>
            <Row label={t('coldbrew.style')} value={t('coldbrew.style' + (recipe.coldBrewStyle === 'slow-drip' ? 'SlowDrip' : 'Immersion'))} />
            <Row label={t('recipe.brewer')} value={gearName ?? recipe.brewer} />
            <Row label={t('coldbrew.steepHours')} value={recipe.steepHours != null ? `${recipe.steepHours} h` : null} />
            {bloom?.water ? (
              <Row
                label={t('coldbrew.hotBloom')}
                value={[
                  `${bloom.water} g`,
                  bloom.tempC != null ? formatTemp(bloom.tempC, unit) : null,
                  bloom.sec != null ? formatSeconds(bloom.sec) : null,
                ].filter(Boolean).join(' · ')}
              />
            ) : null}
            <Row label={t('coldbrew.ice')} value={recipe.iceGrams != null ? `${recipe.iceGrams} g` : null} />
            <Row label={t('coldbrew.dilution')} value={recipe.concentrate && recipe.dilutionRatio ? `1:${recipe.dilutionRatio}` : null} />
          </>
        ) : (
          <>
            <Row label={t('recipe.brewer')} value={gearName ?? recipe.brewer} />
            <Row label={t('recipe.totalTime')} value={formatSeconds(recipe.totalTimeSec)} />
            <Row label={t('recipe.bloom')} value={recipe.bloomSec} />
            <Row label={t('recipe.pours')} value={recipe.pours} />
            {isFlash && <Row label={t('coldbrew.ice')} value={recipe.iceGrams != null ? `${recipe.iceGrams} g` : null} />}
          </>
        )}
        {!isSteep && recipe.steps && recipe.steps.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('recipe.steps')}
            </p>
            <ol className="space-y-1">
              {recipe.steps.map((s, i) => (
                <li key={s.id} className="flex items-baseline gap-2 text-sm">
                  <span className="w-4 shrink-0 text-muted">{i + 1}.</span>
                  <span className="font-medium">{t('step.' + s.type)}</span>
                  <span className="text-muted">
                    {s.type === 'agitation'
                      ? [s.method && t('step.' + s.method), s.intensity && t('step.' + s.intensity)]
                          .filter(Boolean)
                          .join(' · ')
                      : s.type === 'press'
                      ? [s.pressStrength && t('step.press_' + s.pressStrength), s.note]
                          .filter(Boolean)
                          .join(' · ')
                      : [
                          s.water != null ? `${s.water} g` : null,
                          s.pourPattern && t('step.' + s.pourPattern),
                          s.pourHeight && t('step.' + s.pourHeight),
                          s.flowRate && t('step.flow_' + s.flowRate),
                          s.note,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                  </span>
                  {s.atTimeSec != null && (
                    <span className="ml-auto tabular-nums text-muted">{formatSeconds(s.atTimeSec)}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
        {recipe.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{recipe.notes}</p>}
      </div>
      <p className="px-4 pb-2 text-right text-[10px] text-muted">Slurry Stats</p>
    </div>
  )
}
