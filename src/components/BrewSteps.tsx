import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GripVertical, Plus, Trash2, ArrowUp, ArrowDown, Copy, Repeat } from 'lucide-react'
import type {
  AgitationIntensity,
  AgitationMethod,
  BrewStep,
  BrewStepType,
  FlowRate,
  PourHeight,
  PourPattern,
  PressStrength,
} from '@/db/types'
import { uid } from '@/db/dexie'
import { ClockInput } from './ClockInput'

const STEP_TYPES: BrewStepType[] = ['bloom', 'pour', 'agitation', 'wait', 'drawdown', 'press', 'other']
const INTENSITIES: AgitationIntensity[] = ['light', 'medium', 'strong']
const METHODS: AgitationMethod[] = ['swirl', 'stir', 'tap']
const POUR_PATTERNS: PourPattern[] = ['circular', 'elliptical', 'direct', 'edge', 'concentric']
const POUR_HEIGHTS: PourHeight[] = ['low', 'high']
const FLOW_RATES: FlowRate[] = ['slow', 'medium', 'fast']
const PRESS_STRENGTHS: PressStrength[] = ['low', 'medium', 'hard']

const hasWater = (t: BrewStepType) => t === 'bloom' || t === 'pour'
const isAgitation = (t: BrewStepType) => t === 'agitation'
const isPress = (t: BrewStepType) => t === 'press'

export function BrewSteps({
  value,
  onChange,
}: {
  value: BrewStep[]
  onChange: (steps: BrewStep[]) => void
}) {
  const { t } = useTranslation()
  const steps = value ?? []

  const update = (id: string, patch: Partial<BrewStep>) =>
    onChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const remove = (id: string) => onChange(steps.filter((s) => s.id !== id))

  /** Insert a copy of step i right after it, advanced by its own time interval. */
  const duplicate = (i: number) => {
    const s = steps[i]
    const interval = (s.atTimeSec ?? 0) - (steps[i - 1]?.atTimeSec ?? 0)
    const copy: BrewStep = { ...s, id: uid(), atTimeSec: (s.atTimeSec ?? 0) + Math.max(interval, 0) }
    onChange([...steps.slice(0, i + 1), copy, ...steps.slice(i + 1)])
  }
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    const next = [...steps]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const add = () => {
    const last = steps[steps.length - 1]
    onChange([
      ...steps,
      { id: uid(), type: steps.length === 0 ? 'bloom' : 'pour', atTimeSec: last?.atTimeSec },
    ])
  }

  // "Add repeating pours" generator: N equal pours, fixed seconds apart.
  const [repeatOpen, setRepeatOpen] = useState(false)
  const [rCount, setRCount] = useState('4')
  const [rWater, setRWater] = useState('50')
  const [rEvery, setREvery] = useState('30')

  const addRepeat = () => {
    const count = Math.min(Math.max(Math.round(Number(rCount) || 0), 1), 30)
    const water = Number(rWater) || 0
    const every = Number(rEvery) || 0
    const start = steps[steps.length - 1]?.atTimeSec ?? 0
    const pours: BrewStep[] = Array.from({ length: count }, (_, k) => ({
      id: uid(),
      type: 'pour',
      water: water > 0 ? water : undefined,
      atTimeSec: start + (k + 1) * every,
    }))
    onChange([...steps, ...pours])
    setRepeatOpen(false)
  }

  const totalWater = steps.reduce((sum, s) => sum + (hasWater(s.type) ? s.water ?? 0 : 0), 0)

  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div key={s.id} className="card space-y-2 p-2">
          <div className="flex items-center gap-2">
            <span className="flex w-6 items-center justify-center text-sm font-semibold text-muted">
              <GripVertical size={14} className="text-border" />
              {i + 1}
            </span>
            <select
              className="input !py-1.5"
              value={s.type}
              onChange={(e) => update(s.id, { type: e.target.value as BrewStepType })}
            >
              {STEP_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`step.${ty}`)}
                </option>
              ))}
            </select>
            <div className="ml-auto flex gap-1">
              <button type="button" className="text-muted hover:text-text disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp size={16} />
              </button>
              <button type="button" className="text-muted hover:text-text disabled:opacity-30" disabled={i === steps.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown size={16} />
              </button>
              <button type="button" className="text-muted hover:text-text" aria-label={t('recipe.duplicateStep')} onClick={() => duplicate(i)}>
                <Copy size={16} />
              </button>
              <button type="button" className="text-muted hover:text-red-500" onClick={() => remove(s.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pl-6">
            {hasWater(s.type) && (
              <>
                <input
                  className="input !py-1.5"
                  type="number"
                  inputMode="decimal"
                  placeholder={t('recipe.stepWater')}
                  value={s.water ?? ''}
                  onChange={(e) => update(s.id, { water: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
                <select
                  className="input !py-1.5"
                  value={s.pourPattern ?? ''}
                  onChange={(e) => update(s.id, { pourPattern: (e.target.value || undefined) as PourPattern | undefined })}
                >
                  <option value="">{t('step.pourPattern')}</option>
                  {POUR_PATTERNS.map((x) => (
                    <option key={x} value={x}>{t(`step.${x}`)}</option>
                  ))}
                </select>
                <select
                  className="input !py-1.5"
                  value={s.pourHeight ?? ''}
                  onChange={(e) => update(s.id, { pourHeight: (e.target.value || undefined) as PourHeight | undefined })}
                >
                  <option value="">{t('step.pourHeight')}</option>
                  {POUR_HEIGHTS.map((x) => (
                    <option key={x} value={x}>{t(`step.${x}`)}</option>
                  ))}
                </select>
                <select
                  className="input !py-1.5"
                  value={s.flowRate ?? ''}
                  onChange={(e) => update(s.id, { flowRate: (e.target.value || undefined) as FlowRate | undefined })}
                >
                  <option value="">{t('step.flowRate')}</option>
                  {FLOW_RATES.map((x) => (
                    <option key={x} value={x}>{t(`step.flow_${x}`)}</option>
                  ))}
                </select>
              </>
            )}
            {isPress(s.type) && (
              <select
                className="input !py-1.5"
                value={s.pressStrength ?? 'medium'}
                onChange={(e) => update(s.id, { pressStrength: e.target.value as PressStrength })}
              >
                {PRESS_STRENGTHS.map((x) => (
                  <option key={x} value={x}>{t(`step.press_${x}`)}</option>
                ))}
              </select>
            )}
            {isAgitation(s.type) && (
              <>
                <select
                  className="input !py-1.5"
                  value={s.intensity ?? 'light'}
                  onChange={(e) => update(s.id, { intensity: e.target.value as AgitationIntensity })}
                >
                  {INTENSITIES.map((x) => (
                    <option key={x} value={x}>{t(`step.${x}`)}</option>
                  ))}
                </select>
                <select
                  className="input !py-1.5"
                  value={s.method ?? 'swirl'}
                  onChange={(e) => update(s.id, { method: e.target.value as AgitationMethod })}
                >
                  {METHODS.map((x) => (
                    <option key={x} value={x}>{t(`step.${x}`)}</option>
                  ))}
                </select>
              </>
            )}
            <ClockInput
              value={s.atTimeSec}
              onChange={(secs) => update(s.id, { atTimeSec: secs })}
            />
            {!hasWater(s.type) && !isAgitation(s.type) && (
              <input
                className="input !py-1.5"
                placeholder={t('recipe.stepNote')}
                value={s.note ?? ''}
                onChange={(e) => update(s.id, { note: e.target.value })}
              />
            )}
          </div>
        </div>
      ))}

      {repeatOpen && (
        <div className="card space-y-2 p-3">
          <p className="text-sm font-medium">{t('recipe.repeatTitle')}</p>
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="label !mb-1 text-xs">{t('recipe.repeatCount')}</span>
              <input className="input !py-1.5" type="number" inputMode="numeric" min={1} max={30} value={rCount} onChange={(e) => setRCount(e.target.value)} />
            </label>
            <label className="block">
              <span className="label !mb-1 text-xs">{t('recipe.repeatWater')}</span>
              <input className="input !py-1.5" type="number" inputMode="decimal" value={rWater} onChange={(e) => setRWater(e.target.value)} />
            </label>
            <label className="block">
              <span className="label !mb-1 text-xs">{t('recipe.repeatEvery')}</span>
              <input className="input !py-1.5" type="number" inputMode="numeric" value={rEvery} onChange={(e) => setREvery(e.target.value)} />
            </label>
          </div>
          <p className="text-xs text-muted">{t('recipe.repeatHint')}</p>
          <div className="flex gap-2">
            <button type="button" className="btn-primary !py-1.5 flex-1" onClick={addRepeat}>
              {t('recipe.repeatAdd')}
            </button>
            <button type="button" className="btn-ghost !py-1.5" onClick={() => setRepeatOpen(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button type="button" className="btn-ghost !py-1.5" onClick={add}>
            <Plus size={16} /> {t('recipe.addStep')}
          </button>
          <button type="button" className="btn-ghost !py-1.5" onClick={() => setRepeatOpen((o) => !o)}>
            <Repeat size={16} /> {t('recipe.repeatPours')}
          </button>
        </div>
        {totalWater > 0 && (
          <span className="text-sm text-muted">
            {t('recipe.runningTotal')}: <span className="font-semibold text-text">{totalWater} g</span>
          </span>
        )}
      </div>
    </div>
  )
}
