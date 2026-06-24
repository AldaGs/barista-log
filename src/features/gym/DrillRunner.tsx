import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Pause, RotateCcw, Check } from 'lucide-react'
import type { BrewStep } from '@/db/types'
import { formatSeconds } from '@/lib/units'
import { cue, useWakeLock } from '@/lib/feedback'
import { usePourDrill, type DrillSegment } from '@/lib/pourDrill'
import { PourCanvas } from './PourCanvas'

/** One-line recipe instruction for a step: type · g · pattern · height · flow. */
function stepInstruction(s: BrewStep, t: (k: string) => string): string {
  return [
    t('step.' + s.type),
    s.water != null ? `${s.water} g` : null,
    s.pourPattern && t('step.' + s.pourPattern),
    s.pourHeight && t('step.' + s.pourHeight),
    s.flowRate && t('step.flow_' + s.flowRate),
  ]
    .filter(Boolean)
    .join(' · ')
}

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

  // Keep the active step card in view as the drill advances, like the guided
  // brew player — but scroll *inside* the schedule list so the pour animation
  // and timer stay put. Only while running, so an idle page isn't yanked around.
  const listRef = useRef<HTMLOListElement | null>(null)
  const activeStepRef = useRef<HTMLLIElement | null>(null)
  useEffect(() => {
    const li = activeStepRef.current
    const ol = listRef.current
    if (run.running && li && ol) {
      ol.scrollTo({ top: li.offsetTop - ol.clientHeight / 2 + li.clientHeight / 2, behavior: 'smooth' })
    }
  }, [cur?.stepIndex, run.running])

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

  // The recipe schedule behind this drill (empty for free Gym pulse drills),
  // de-duplicated from the segments so the runner can mirror the real pour-over.
  const recipeSteps = useMemo(() => {
    const out: { index: number; step: BrewStep; target: number }[] = []
    const seen = new Set<number>()
    for (const seg of segments) {
      if (seg.step && seg.stepIndex != null && !seen.has(seg.stepIndex)) {
        seen.add(seg.stepIndex)
        out.push({ index: seg.stepIndex, step: seg.step, target: seg.target ?? 0 })
      }
    }
    return out.sort((a, b) => a.index - b.index)
  }, [segments])
  const isRecipe = recipeSteps.length > 0

  // Next recipe step to preview while the current one runs.
  const nextStep = useMemo(() => {
    if (cur?.stepIndex == null) return null
    return recipeSteps.find((s) => s.index > cur.stepIndex!) ?? null
  }, [recipeSteps, cur?.stepIndex])

  const pourLabel = cur?.pulse ? `${t('gym.pourNow')} ${cur.pulse[0]}/${cur.pulse[1]}` : t('gym.pourNow')
  // For a recipe drill, name the real step (Bloom/Pour/Drawdown …) the whole
  // time it runs — the pour-timing line below tells the barista when to stop
  // pouring and hold, just like the guided brew player.
  const phaseLabel = run.done
    ? t('gym.done')
    : isRecipe && cur
      ? t('step.' + (cur.label ?? (pouring ? 'pour' : 'wait')))
      : cur?.label
        ? t('step.' + cur.label)
        : pouring
          ? pourLabel
          : t('gym.rest_phase')

  // Pour detail line (pattern · height · flow) shown while pouring a recipe step.
  const pourDetail =
    isRecipe && pouring && cur?.step
      ? [
          cur.step.pourPattern && t('step.' + cur.step.pourPattern),
          cur.step.pourHeight && t('step.' + cur.step.pourHeight),
          cur.step.flowRate && t('step.flow_' + cur.step.flowRate),
        ]
          .filter(Boolean)
          .join(' · ')
      : ''

  // Pour-timing cue, like the brew player: while pouring a recipe step, count
  // down how long to keep pouring (the segment is exactly the pour duration at
  // the recipe's flow rate); during the hold after it, say the pour is done.
  const isPourStep = isRecipe && (cur?.label === 'pour' || cur?.label === 'bloom')
  const pourStatus =
    isPourStep && !run.done
      ? pouring && Math.ceil(run.segRemaining) > 0
        ? { text: t('play.finishPourIn', { secs: Math.ceil(run.segRemaining) }), active: true }
        : { text: t('play.pourDone'), active: false }
      : null

  // Step number/total read off the recipe schedule, not the raw segment list.
  const stepNum = cur?.stepIndex != null ? cur.stepIndex + 1 : run.index + 1
  const stepTotal = isRecipe ? recipeSteps.length : segments.length

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
        {pourDetail && <p className="-mt-0.5 text-sm text-muted">{pourDetail}</p>}
        <span className="font-mono text-5xl tabular-nums">{formatSeconds(Math.floor(run.elapsed))}</span>
        {totalWater > 0 && (
          <p className="text-2xl font-bold tabular-nums text-brand">
            {Math.round(pouredWater)} <span className="text-base text-muted">/ {Math.round(totalWater)} g</span>
          </p>
        )}
        {pourStatus && (
          <p className={`text-sm font-semibold ${pourStatus.active ? 'text-accent' : 'text-muted'}`}>
            {pourStatus.text}
          </p>
        )}
        {!run.done && cur && (
          <p className="text-sm text-muted">
            {t('gym.secsLeft', { secs: Math.ceil(run.segRemaining) })}
            {!cur.pulse && stepTotal > 1 && ` · ${t('gym.segment', { i: stepNum, n: stepTotal })}`}
          </p>
        )}
        {!run.done && isRecipe && nextStep && (
          <p className="mt-1 text-sm text-muted">
            {t('play.next')}: {stepInstruction(nextStep.step, t)}
            {nextStep.target > 0 && <span className="ml-1 tabular-nums">→ {nextStep.target} g</span>}
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

      {/* Recipe schedule — mirrors the guided brew player so practicing the
          drill feels like running the real pour-over of this recipe. */}
      {isRecipe && (
        <ol ref={listRef} className="max-h-[45vh] space-y-2 overflow-y-auto">
          {recipeSteps.map(({ index, step, target }) => {
            const active = cur?.stepIndex === index && !run.done
            const passed = (cur?.stepIndex != null && index < cur.stepIndex) || run.done
            return (
              <li
                key={step.id ?? index}
                ref={active ? activeStepRef : undefined}
                className={`card flex items-center gap-3 p-3 transition ${
                  active ? 'border-brand ring-1 ring-brand/40' : passed ? 'opacity-60' : ''
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">
                  {passed ? <Check size={14} className="text-accent" /> : index + 1}
                </span>
                <span className={`flex-1 text-sm ${active ? 'font-semibold' : ''}`}>
                  {stepInstruction(step, t)}
                </span>
                <span className="flex shrink-0 flex-col items-end leading-tight">
                  {target > 0 && (
                    <span className="text-sm font-semibold tabular-nums text-brand">{target} g</span>
                  )}
                  {step.atTimeSec != null && (
                    <span className="text-xs tabular-nums text-muted">{formatSeconds(step.atTimeSec)}</span>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
