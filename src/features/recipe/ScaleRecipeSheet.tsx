import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, Scale, Plus } from 'lucide-react'
import type { Recipe } from '@/db/types'
import { scaleByFactor, type ScaledRecipe } from '@/lib/scaleRecipe'
import { saveRecipe, parseFamily } from '@/db/repo'

/**
 * Calculator that scales a recipe to a new dose (or total water) while holding
 * the ratio, times and temperatures fixed. Read the numbers off, or save the
 * result as a new recipe.
 */
export function ScaleRecipeSheet({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'dose' | 'water'>('dose')
  const [target, setTarget] = useState(
    String(mode === 'dose' ? recipe.doseIn ?? '' : recipe.yieldOut ?? ''),
  )

  const baseVal = mode === 'dose' ? recipe.doseIn : recipe.yieldOut
  const scaled: ScaledRecipe | null = useMemo(() => {
    const tgt = Number(target)
    if (!baseVal || baseVal <= 0 || !tgt || tgt <= 0) return null
    return scaleByFactor(recipe, tgt / baseVal)
  }, [recipe, target, baseVal, mode])

  const switchMode = (m: 'dose' | 'water') => {
    setMode(m)
    setTarget(String((m === 'dose' ? recipe.doseIn : recipe.yieldOut) ?? ''))
  }

  async function saveAsNew() {
    if (!scaled) return
    const { base } = parseFamily(recipe.title)
    const label = scaled.doseIn != null ? `${scaled.doseIn} g` : `×${scaled.factor.toFixed(2)}`
    const { id: _id, createdAt: _c, updatedAt: _u, dirty: _d, syncedAt: _s, ...rest } = recipe
    const id = await saveRecipe({
      ...rest,
      title: `${base || t('method.' + recipe.method)} (${label})`,
      doseIn: scaled.doseIn,
      yieldOut: scaled.yieldOut,
      steps: scaled.steps,
      hotBloom: scaled.hotBloom,
      iceGrams: scaled.iceGrams,
    })
    onClose()
    navigate(`/recipe/${id}`)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-t-2xl bg-surface p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Scale size={18} /> {t('scale.title')}
          </h2>
          <button onClick={onClose} className="btn-ghost !px-2" aria-label={t('common.cancel')}>
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-muted">{t('scale.hint')}</p>

        <div className="flex gap-2">
          {(['dose', 'water'] as const).map((m) => (
            <button
              key={m}
              disabled={m === 'dose' ? !recipe.doseIn : !recipe.yieldOut}
              onClick={() => switchMode(m)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm disabled:opacity-40 ${mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted'}`}
            >
              {t(m === 'dose' ? 'scale.byDose' : 'scale.byWater')}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="label">{t(mode === 'dose' ? 'scale.targetDose' : 'scale.targetWater')}</span>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            autoFocus
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>

        {scaled ? (
          <div className="space-y-2 rounded-lg bg-surface-2 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">{t('scale.factor')}</span>
              <span className="tabular-nums">×{scaled.factor.toFixed(2)}</span>
            </div>
            {scaled.doseIn != null && (
              <div className="flex justify-between">
                <span>{t('recipe.doseIn')}</span>
                <span className="font-medium tabular-nums">{scaled.doseIn} g</span>
              </div>
            )}
            {scaled.yieldOut != null && (
              <div className="flex justify-between">
                <span>{t('recipe.yieldOut')}</span>
                <span className="font-medium tabular-nums">{scaled.yieldOut} g</span>
              </div>
            )}
            {scaled.steps && scaled.steps.length > 0 && (
              <div className="border-t border-border/60 pt-2">
                <p className="mb-1 text-xs uppercase tracking-wide text-muted">{t('scale.pours')}</p>
                <ol className="space-y-0.5">
                  {scaled.steps
                    .filter((st) => st.water != null)
                    .map((st, i) => (
                      <li key={st.id ?? i} className="flex justify-between tabular-nums">
                        <span className="text-muted">{t('step.' + st.type)}</span>
                        <span>{st.water} g</span>
                      </li>
                    ))}
                </ol>
              </div>
            )}
            {scaled.iceGrams != null && (
              <div className="flex justify-between">
                <span>{t('coldbrew.ice')}</span>
                <span className="tabular-nums">{scaled.iceGrams} g</span>
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-center text-xs text-muted">{t('scale.needBase')}</p>
        )}

        <button className="btn-primary w-full" onClick={saveAsNew} disabled={!scaled}>
          <Plus size={18} /> {t('scale.saveAsNew')}
        </button>
      </div>
    </div>
  )
}
