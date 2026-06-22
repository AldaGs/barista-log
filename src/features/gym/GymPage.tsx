import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui'
import { useSettings } from '@/store/settings'
import type { FlowRate, PourPattern } from '@/db/types'
import { buildPulseDrill } from '@/lib/pourDrill'
import { DrillRunner } from './DrillRunner'

const PATTERNS: PourPattern[] = ['circular', 'concentric', 'elliptical', 'edge', 'direct']
const PACES: FlowRate[] = ['slow', 'medium', 'fast']

export default function GymPage() {
  const { t } = useTranslation()
  const pourRates = useSettings((s) => s.pourRates)

  const [pattern, setPattern] = useState<PourPattern>('circular')
  const [pace, setPace] = useState<FlowRate>('medium')
  const [water, setWater] = useState('250')
  const [pulses, setPulses] = useState('1')
  const [rest, setRest] = useState('20')
  const [metronome, setMetronome] = useState(true)

  const segments = useMemo(
    () =>
      buildPulseDrill({
        water: Number(water) || 0,
        pulses: Number(pulses) || 1,
        rest: Number(rest) || 0,
        rate: pourRates[pace] || pourRates.medium,
        pattern,
      }),
    [water, pulses, rest, pace, pattern, pourRates],
  )

  // Reset the run when the recipe of the drill changes by re-mounting the runner.
  const runnerKey = `${pattern}-${pace}-${water}-${pulses}-${rest}-${metronome}`

  return (
    <div className="space-y-5">
      <PageHeader title={t('gym.title')} back />
      <p className="text-sm text-muted">{t('gym.intro')}</p>

      <DrillRunner key={runnerKey} segments={segments} metronome={metronome} />

      <div className="card space-y-4 p-4">
        {/* Pattern */}
        <div>
          <p className="label !mb-1.5">{t('gym.pattern')}</p>
          <div className="flex flex-wrap gap-2">
            {PATTERNS.map((p) => (
              <button
                key={p}
                onClick={() => setPattern(p)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  pattern === p ? 'bg-brand text-white' : 'bg-surface-2 text-muted'
                }`}
              >
                {t(`step.${p}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Pace */}
        <div>
          <p className="label !mb-1.5">{t('gym.pace')}</p>
          <div className="flex gap-2">
            {PACES.map((p) => (
              <button
                key={p}
                onClick={() => setPace(p)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm ${
                  pace === p ? 'bg-brand text-white' : 'bg-surface-2 text-muted'
                }`}
              >
                {t(`step.flow_${p}`)}
                <span className="ml-1 text-xs opacity-70">{pourRates[p]} g/s</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="label !mb-1 text-xs">{t('gym.water')}</span>
            <input className="input !py-1.5" type="number" inputMode="decimal" value={water} onChange={(e) => setWater(e.target.value)} />
          </label>
          <label className="block">
            <span className="label !mb-1 text-xs">{t('gym.pulses')}</span>
            <input className="input !py-1.5" type="number" inputMode="numeric" min={1} max={20} value={pulses} onChange={(e) => setPulses(e.target.value)} />
          </label>
          <label className="block">
            <span className="label !mb-1 text-xs">{t('gym.rest')}</span>
            <input className="input !py-1.5" type="number" inputMode="numeric" value={rest} onChange={(e) => setRest(e.target.value)} disabled={Number(pulses) <= 1} />
          </label>
        </div>

        <label className="flex items-center justify-between">
          <span className="text-sm">{t('gym.metronome')}</span>
          <input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={metronome} onChange={(e) => setMetronome(e.target.checked)} />
        </label>
      </div>
    </div>
  )
}
