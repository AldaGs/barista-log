import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { formatSeconds } from '@/lib/units'
import { useWakeLock } from '@/lib/feedback'
import { usePourDrill, type DrillSegment } from '@/lib/pourDrill'
import { PourCanvas } from './PourCanvas'

/** Runs a list of drill segments: animated brewer, timer, pace cues and controls. */
export function DrillRunner({ segments, metronome }: { segments: DrillSegment[]; metronome: boolean }) {
  const { t } = useTranslation()
  const run = usePourDrill(segments, metronome)
  useWakeLock(run.running)

  const cur = segments[run.index]
  const pouring = !!cur && cur.kind === 'pour'

  // Cumulative water poured so far, and the grand total, for the ring + readout.
  const totalWater = useMemo(
    () => segments.reduce((s, x) => s + (x.water ?? 0), 0),
    [segments],
  )
  const pouredWater = useMemo(() => {
    let acc = 0
    let tElapsed = run.elapsed
    for (const seg of segments) {
      if (tElapsed <= 0) break
      const frac = Math.min(1, tElapsed / seg.seconds)
      if (seg.water) acc += seg.water * frac
      tElapsed -= seg.seconds
    }
    return acc
  }, [segments, run.elapsed])

  const phaseLabel = run.done
    ? t('gym.done')
    : cur?.label
      ? t('step.' + cur.label)
      : pouring
        ? t('gym.pourNow')
        : t('gym.rest_phase')

  return (
    <div className="space-y-4">
      <PourCanvas
        pattern={cur?.pattern}
        pouring={pouring && run.running}
        elapsed={run.elapsed}
        waterFrac={totalWater > 0 ? pouredWater / totalWater : run.total > 0 ? run.elapsed / run.total : 0}
      />

      <div className="card flex flex-col items-center gap-1 p-5 text-center">
        <p className={`text-lg font-semibold ${pouring ? 'text-brand' : run.done ? 'text-accent' : 'text-muted'}`}>
          {phaseLabel}
        </p>
        <span className="font-mono text-5xl tabular-nums">{formatSeconds(Math.floor(run.elapsed))}</span>
        {totalWater > 0 && (
          <p className="text-2xl font-bold tabular-nums text-brand">
            {Math.round(pouredWater)} <span className="text-base text-muted">/ {Math.round(totalWater)} g</span>
          </p>
        )}
        {!run.done && cur && (
          <p className="text-sm text-muted">
            {t('gym.segment', { i: run.index + 1, n: segments.length })} ·{' '}
            {t('gym.secsLeft', { secs: Math.ceil(run.segRemaining) })}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={run.running ? run.pause : run.start}>
          {run.running ? <Pause size={18} /> : <Play size={18} />}
          {run.running ? t('gym.pause') : run.elapsed > 0 ? t('gym.resume') : t('gym.start')}
        </button>
        <button className="btn-ghost" onClick={run.reset}>
          <RotateCcw size={18} /> {t('gym.reset')}
        </button>
      </div>
    </div>
  )
}
