import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import type { PressureStage, PressureStageLabel } from '@/db/types'
import { uid } from '@/db/dexie'
import { PressureCurve } from '@/components/PressureCurve'

const LABELS: PressureStageLabel[] = ['preinfusion', 'ramp', 'hold', 'decline', 'other']

/** Sensible starting stage when adding the first row / a new row. */
const PRESETS: Record<PressureStageLabel, { sec: number; bar: number }> = {
  preinfusion: { sec: 5, bar: 3 },
  ramp: { sec: 4, bar: 9 },
  hold: { sec: 15, bar: 9 },
  decline: { sec: 6, bar: 6 },
  other: { sec: 5, bar: 9 },
}

const num = (v: string) => (v === '' ? 0 : Number(v))

/**
 * Editable espresso pressure profile: an ordered list of stages (label · seconds
 * · bar) with a live curve preview. Optional — leaving it empty keeps the recipe
 * on the simple single-pressure model.
 */
export function PressureProfileEditor({
  value,
  onChange,
}: {
  value: PressureStage[] | undefined
  onChange: (stages: PressureStage[]) => void
}) {
  const { t } = useTranslation()
  const stages = value ?? []

  const update = (id: string, patch: Partial<PressureStage>) =>
    onChange(stages.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const remove = (id: string) => onChange(stages.filter((s) => s.id !== id))
  const add = () => {
    // Suggest the next typical stage in the preinfusion → ramp → hold → decline arc.
    const next: PressureStageLabel =
      stages.length === 0 ? 'preinfusion' : LABELS[Math.min(stages.length, LABELS.length - 1)]
    onChange([...stages, { id: uid(), label: next, ...PRESETS[next] }])
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="label">{t('recipe.pressureProfile')}</span>
        <p className="text-xs text-muted">{t('recipe.pressureProfileHint')}</p>
      </div>

      {stages.length > 0 && (
        <>
          <div className="card bg-surface-2/40 p-2">
            <PressureCurve stages={stages} />
          </div>
          <div className="space-y-2">
            {stages.map((s) => (
              <div key={s.id} className="flex items-end gap-2">
                <label className="flex-1">
                  <span className="label text-xs">{t('recipe.stageLabel')}</span>
                  <select
                    className="input"
                    value={s.label ?? 'other'}
                    onChange={(e) => update(s.id, { label: e.target.value as PressureStageLabel })}
                  >
                    {LABELS.map((l) => (
                      <option key={l} value={l}>{t('recipe.stage.' + l)}</option>
                    ))}
                  </select>
                </label>
                <label className="w-20">
                  <span className="label text-xs">{t('recipe.stageSec')}</span>
                  <input
                    className="input"
                    type="number"
                    inputMode="decimal"
                    value={s.sec || ''}
                    onChange={(e) => update(s.id, { sec: num(e.target.value) })}
                  />
                </label>
                <label className="w-20">
                  <span className="label text-xs">{t('recipe.stageBar')}</span>
                  <input
                    className="input"
                    type="number"
                    inputMode="decimal"
                    value={s.bar || ''}
                    onChange={(e) => update(s.id, { bar: num(e.target.value) })}
                  />
                </label>
                <button
                  type="button"
                  className="btn-ghost !px-2 pb-2 text-muted hover:text-red-500"
                  onClick={() => remove(s.id)}
                  aria-label={t('common.delete')}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <button type="button" className="btn-ghost w-full" onClick={add}>
        <Plus size={16} /> {t('recipe.addStage')}
      </button>
    </div>
  )
}
