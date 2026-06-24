import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { formatSeconds } from '@/lib/units'
import { cue, useWakeLock } from '@/lib/feedback'
import { usePourDrill, type DrillSegment } from '@/lib/pourDrill'
import { PourCanvas } from './PourCanvas'

/** Runs a list of drill segments: animated brewer, timer, pace cues and controls. */
export function DrillRunner({
  segments,
  metronome,
  onComplete,
}: {
  segments: DrillSegment[]
  metronome: boolean
  /** called once with the drill length (s) each time a run reaches the end */
  onComplete?: (seconds: number) => void
}) {
  const { t } = useTranslation()
  const run = usePourDrill(segments, metronome)
  useWakeLock(run.running)

  // Fire onComplete exactly once per finished run. Latch resets when the run is
  // restarted (elapsed returns to 0), so a replay logs again but a re-render
  // while sitting at "done" does not.
  const completedRef = useRef(false)
  useEffect(() => {
    if (run.done && !completedRef.current) {
      completedRef.current = true
      if (run.total > 0) onComplete?.(Math.round(run.total))
    } else if (run.elapsed === 0) {
      completedRef.current = false
    }
  }, [run.done, run.elapsed, run.total, onComplete])

  const cur = segments[run.index]
  const pouring = !!cur && cur.kind === 'pour'

  // Optional pre-start countdown (0 = off, 3 or 5 seconds), remembered per device.
  const [countdownPref, setCountdownPref] = useState<number>(() => {
    const v = Number(localStorage.getItem('gymCountdown'))
    return v === 3 || v === 5 ? v : 0
  })
  useEffect(() => {
    localStorage.setItem('gymCountdown', String(countdownPref))
  }, [countdownPref])

  const [counting, setCounting] = useState<number | null>(null)
  const countRef = useRef<number | null>(null)
  useEffect(() => {
    if (counting == null) return
    if (counting <= 0) {
      setCounting(null)
      cue(true)
      run.start()
      return
    }
    cue()
    countRef.current = window.setTimeout(() => setCounting((c) => (c == null ? null : c - 1)), 1000)
    return () => {
      if (countRef.current) window.clearTimeout(countRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counting])

  function handlePlay() {
    if (run.running) {
      run.pause()
      return
    }
    if (counting != null) {
      setCounting(null)
      return
    }
    if (run.elapsed === 0 && countdownPref > 0) {
      setCounting(countdownPref)
      return
    }
    run.start()
  }
  function handleReset() {
    setCounting(null)
    run.reset()
  }

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

  const pourLabel = cur?.pulse ? `${t('gym.pourNow')} ${cur.pulse[0]}/${cur.pulse[1]}` : t('gym.pourNow')
  const phaseLabel = run.done
    ? t('gym.done')
    : cur?.label
      ? t('step.' + cur.label)
      : pouring
        ? pourLabel
        : t('gym.rest_phase')

  const idle = run.elapsed === 0 && !run.running && counting == null

  return (
    <div className="space-y-4">
      <PourCanvas
        pattern={cur?.pattern}
        pouring={pouring && run.running}
        elapsed={run.elapsed}
        waterFrac={totalWater > 0 ? pouredWater / totalWater : run.total > 0 ? run.elapsed / run.total : 0}
      />

      <div className="card relative flex flex-col items-center gap-1 p-5 text-center">
        {counting != null && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[inherit] bg-surface/95">
            <span className="font-mono text-6xl font-bold tabular-nums text-brand">{counting}</span>
            <span className="mt-1 text-sm text-muted">{t('play.getReady')}</span>
          </div>
        )}
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
            {t('gym.secsLeft', { secs: Math.ceil(run.segRemaining) })}
            {!cur.pulse && segments.length > 1 && ` · ${t('gym.segment', { i: run.index + 1, n: segments.length })}`}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={handlePlay}>
          {run.running || counting != null ? <Pause size={18} /> : <Play size={18} />}
          {run.running || counting != null ? t('gym.pause') : run.elapsed > 0 ? t('gym.resume') : t('gym.start')}
        </button>
        <button className="btn-ghost" onClick={handleReset}>
          <RotateCcw size={18} /> {t('gym.reset')}
        </button>
      </div>

      {/* Pre-start countdown preference */}
      {idle && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted">
          <span>{t('play.countdown')}:</span>
          {([0, 3, 5] as const).map((n) => (
            <button
              key={n}
              onClick={() => setCountdownPref(n)}
              className={`rounded-full px-3 py-1 ${countdownPref === n ? 'bg-brand text-white' : 'bg-surface-2'}`}
            >
              {n === 0 ? t('play.off') : `${n}s`}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
