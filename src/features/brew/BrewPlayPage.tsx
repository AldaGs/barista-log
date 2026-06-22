import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Play, Pause, RotateCcw, Check, Flag, X } from 'lucide-react'
import { db } from '@/db/dexie'
import type { BrewStep, FlowRate } from '@/db/types'
import { PageHeader, EmptyState } from '@/components/ui'
import { formatSeconds } from '@/lib/units'
import { cue, useWakeLock } from '@/lib/feedback'
import { useSettings } from '@/store/settings'
import { useBrewPlayer, elapsedSec } from '@/store/brewPlayer'

/**
 * How many seconds a step's pour should take, from its water amount and flow
 * rate (g/s). Only pour/bloom steps with water have a pour; returns null
 * otherwise. Unspecified flow rates fall back to the medium pour rate.
 */
function pourDurationSec(step: BrewStep, rates: Record<FlowRate, number>): number | null {
  if ((step.type !== 'pour' && step.type !== 'bloom') || !step.water || step.water <= 0) return null
  const rate = rates[step.flowRate ?? 'medium'] || rates.medium
  return rate > 0 ? step.water / rate : null
}

function stepLabel(s: BrewStep, t: (k: string) => string) {
  if (s.type === 'agitation') {
    return [t('step.' + s.type), s.method && t('step.' + s.method), s.intensity && t('step.' + s.intensity)]
      .filter(Boolean)
      .join(' · ')
  }
  if (s.type === 'press') {
    return [t('step.' + s.type), s.pressStrength && t('step.press_' + s.pressStrength), s.note]
      .filter(Boolean)
      .join(' · ')
  }
  return [
    t('step.' + s.type),
    s.water != null ? `${s.water} g` : null,
    s.pourPattern && t('step.' + s.pourPattern),
    s.pourHeight && t('step.' + s.pourHeight),
    s.flowRate && t('step.flow_' + s.flowRate),
    s.note,
  ]
    .filter(Boolean)
    .join(' · ')
}

export default function BrewPlayPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const recipe = useLiveQuery(() => (id ? db.recipes.get(id) : undefined), [id])
  const pourRates = useSettings((s) => s.pourRates)
  const stepEndCountdown = useSettings((s) => s.stepEndCountdown)
  const pourMarkCue = useSettings((s) => s.pourMarkCue)

  // Durable, wall-clock brew state — survives navigating away & back.
  const player = useBrewPlayer()
  const { running, laps } = player

  // Adopt this recipe's brew. If a brew for *this* recipe is already open we
  // keep it (the whole point — accidental navigation must not reset it);
  // otherwise start a fresh idle brew for it.
  useEffect(() => {
    if (id && player.recipeId !== id) player.begin(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Re-render every tick while running so the wall-clock elapsed updates.
  const [, tick] = useReducer((c) => c + 1, 0)
  useEffect(() => {
    if (!running) return
    const iv = window.setInterval(tick, 500)
    return () => window.clearInterval(iv)
  }, [running])

  const elapsed = player.recipeId === id ? elapsedSec(player) : 0

  // Optional pre-start countdown (0 = off, 3 or 5 seconds).
  const [countdownPref, setCountdownPref] = useState<number>(() => {
    const v = Number(localStorage.getItem('brewCountdown'))
    return v === 3 || v === 5 ? v : 0
  })
  const [counting, setCounting] = useState<number | null>(null)
  const countRef = useRef<number | null>(null)

  useEffect(() => {
    localStorage.setItem('brewCountdown', String(countdownPref))
  }, [countdownPref])

  // Tick down the pre-start countdown, then begin the brew.
  useEffect(() => {
    if (counting == null) return
    if (counting <= 0) {
      setCounting(null)
      cue(true)
      player.startRunning()
      return
    }
    cue()
    countRef.current = window.setTimeout(() => setCounting((c) => (c == null ? null : c - 1)), 1000)
    return () => {
      if (countRef.current) window.clearTimeout(countRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counting])

  function handlePlayPause() {
    if (running) {
      player.pause()
      return
    }
    if (counting != null) {
      // Cancel an in-progress countdown.
      setCounting(null)
      return
    }
    if (elapsed === 0 && countdownPref > 0) {
      setCounting(countdownPref)
      return
    }
    player.startRunning()
  }

  function reset() {
    setCounting(null)
    player.restart()
  }

  /** Close the brew entirely and leave the page. */
  function discard() {
    player.close()
    navigate('/')
  }

  /** Stamp the current elapsed time as a checkpoint (e.g. when a pour finishes). */
  function markLap() {
    cue()
    player.addLap(elapsed)
  }

  const steps = useMemo(
    () => [...(recipe?.steps ?? [])].sort((a, b) => (a.atTimeSec ?? 0) - (b.atTimeSec ?? 0)),
    [recipe?.steps],
  )

  // Each step's time is the checkpoint it should be *finished* by. A step runs
  // from the previous step's time (0 for the first) up to its own time. The
  // current step is the first one not yet finished; -1 means the brew is done.
  const currentIndex = useMemo(
    () => steps.findIndex((s) => elapsed < (s.atTimeSec ?? 0)),
    [steps, elapsed],
  )
  const isComplete = currentIndex === -1
  const activeIndex = isComplete ? steps.length : currentIndex

  // Running cumulative target weight after each step.
  const cumWater = useMemo(() => {
    let sum = 0
    return steps.map((s) => (sum += s.water ?? 0))
  }, [steps])

  // Keep the screen awake while brewing; beep/vibrate when a step changes.
  useWakeLock(running)
  const prevActive = useRef(-1)
  useEffect(() => {
    if (activeIndex !== prevActive.current) {
      if (running) cue(isComplete)
      prevActive.current = activeIndex
    }
  }, [activeIndex, running, isComplete])

  const currentStep = isComplete ? null : steps[currentIndex]
  const nextStep = isComplete ? null : steps[currentIndex + 1]
  // Seconds left in the current step (i.e. until the next one begins).
  const countdown = currentStep ? (currentStep.atTimeSec ?? 0) - elapsed : null

  const stepStart = (i: number) => (i === 0 ? 0 : steps[i - 1].atTimeSec ?? 0)

  // Fraction [0,1] of a step's time window that has elapsed — drives the pill fill.
  const stepFill = (i: number) => {
    if (i < activeIndex) return 1
    if (i > activeIndex) return 0
    const start = stepStart(i)
    const end = steps[i].atTimeSec ?? 0
    if (end <= start) return 1
    return Math.min(1, Math.max(0, (elapsed - start) / (end - start)))
  }

  // Fraction of a step's time window that should be spent actively pouring — the
  // "finalize the pour" zone shown as an extra overlay on the pill.
  const pourFrac = (i: number) => {
    const dur = pourDurationSec(steps[i], pourRates)
    if (dur == null) return 0
    const window = (steps[i].atTimeSec ?? 0) - stepStart(i)
    if (window <= 0) return 1
    return Math.min(1, dur / window)
  }

  const targetWater = isComplete ? cumWater[cumWater.length - 1] : cumWater[currentIndex]

  // Pour status for the current step: how long to keep pouring and how much is done.
  const currentPourDur = currentStep ? pourDurationSec(currentStep, pourRates) : null
  const pourElapsed = currentStep ? elapsed - stepStart(currentIndex) : 0
  const pourRemaining =
    currentPourDur != null ? Math.max(0, Math.ceil(currentPourDur - pourElapsed)) : null

  // Keep the active step in view as the brew advances through a long list.
  const activeStepRef = useRef<HTMLLIElement | null>(null)
  useEffect(() => {
    activeStepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeIndex])

  // Soft beep down the final seconds before the current step ends.
  const lastEndBeep = useRef<number | null>(null)
  useEffect(() => {
    if (!running || countdown == null) {
      lastEndBeep.current = null
      return
    }
    if (stepEndCountdown > 0 && countdown >= 1 && countdown <= stepEndCountdown) {
      if (lastEndBeep.current !== countdown) {
        lastEndBeep.current = countdown
        cue()
      }
    }
  }, [countdown, running, stepEndCountdown])

  // Soft beep the moment the active pour should be finished (hits its mark).
  const prevPourRemaining = useRef<number | null>(null)
  useEffect(() => {
    if (
      running &&
      pourMarkCue &&
      prevPourRemaining.current != null &&
      prevPourRemaining.current > 0 &&
      pourRemaining === 0
    ) {
      cue()
    }
    prevPourRemaining.current = pourRemaining
  }, [pourRemaining, running, pourMarkCue])

  if (recipe === undefined) return null
  if (!recipe) return <p className="text-muted">Not found.</p>

  return (
    <div className="space-y-5">
      <PageHeader
        title={recipe.title || t('play.title')}
        back
        action={
          <button
            onClick={() => {
              if (elapsed === 0 || confirm(t('play.discardConfirm'))) discard()
            }}
            className="btn-ghost !px-2"
            aria-label={t('play.discard')}
          >
            <X size={18} />
          </button>
        }
      />

      {steps.length === 0 ? (
        <EmptyState>{t('play.noSteps')}</EmptyState>
      ) : (
        <>
          {/* Big timer + current instruction — pinned so it stays visible
              while the step list scrolls underneath. */}
          <div className="card sticky top-0 z-10 flex flex-col items-center gap-2 p-6 text-center shadow-sm">
            {counting != null && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[inherit] bg-surface/95">
                <span className="font-mono text-7xl font-bold tabular-nums text-brand">{counting}</span>
                <span className="mt-1 text-sm text-muted">{t('play.getReady')}</span>
              </div>
            )}
            <span className="font-mono text-5xl tabular-nums">{formatSeconds(elapsed)}</span>
            {currentStep ? (
              <p className="text-lg font-semibold">{stepLabel(currentStep, t)}</p>
            ) : (
              <p className="font-semibold text-accent">{t('play.complete')}</p>
            )}
            {targetWater > 0 && (
              <p className="text-2xl font-bold tabular-nums text-brand">{targetWater} g</p>
            )}
            {currentPourDur != null && (
              <p
                className={`text-sm font-semibold ${pourRemaining ? 'text-accent' : 'text-muted'}`}
              >
                {pourRemaining
                  ? t('play.finishPourIn', { secs: pourRemaining })
                  : t('play.pourDone')}
              </p>
            )}
            {nextStep && (
              <p className="mt-1 text-sm text-muted">
                {t('play.next')}: {stepLabel(nextStep, t)}
                {cumWater[currentIndex + 1] > cumWater[currentIndex] && (
                  <span className="ml-1 tabular-nums">→ {cumWater[currentIndex + 1]} g</span>
                )}
                {countdown != null && countdown > 0 && (
                  <span className="ml-2 font-semibold text-brand">{t('play.now')} +{countdown}s</span>
                )}
              </p>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={handlePlayPause}>
              {running || counting != null ? <Pause size={18} /> : <Play size={18} />}
              {running || counting != null
                ? t('play.pause')
                : elapsed > 0
                  ? t('play.resume')
                  : t('play.start')}
            </button>
            <button
              className="btn-ghost"
              onClick={markLap}
              disabled={!running}
              aria-label={t('play.mark')}
            >
              <Flag size={18} /> {t('play.mark')}
            </button>
            <button className="btn-ghost" onClick={reset}>
              <RotateCcw size={18} /> {t('play.reset')}
            </button>
          </div>

          {laps.length > 0 && (
            <p className="text-center text-xs text-muted">
              {t('play.markedCount', { count: laps.length })}: {laps.map((l) => formatSeconds(l)).join(' · ')}
            </p>
          )}

          {/* Pre-start countdown preference */}
          {elapsed === 0 && counting == null && !running && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted">
              <span>{t('play.countdown')}:</span>
              {([0, 3, 5] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setCountdownPref(n)}
                  className={`rounded-full px-3 py-1 ${
                    countdownPref === n ? 'bg-brand text-white' : 'bg-surface-2'
                  }`}
                >
                  {n === 0 ? t('play.off') : `${n}s`}
                </button>
              ))}
            </div>
          )}

          {/* Finish → log this brew, carrying the captured actual timeline */}
          <Link
            to={`/recipe/${recipe.id}/log`}
            state={
              elapsed > 0
                ? { actualTotalSec: elapsed, actualLaps: laps }
                : undefined
            }
            className={isComplete ? 'btn-primary w-full' : 'btn-ghost w-full'}
          >
            <Check size={18} /> {t('session.logBrew')}
          </Link>

          {/* Step list */}
          <ol className="space-y-2">
            {steps.map((s, i) => {
              const passed = i < activeIndex
              const active = i === activeIndex
              const fill = stepFill(i)
              const pFrac = pourFrac(i)
              return (
                <li
                  key={s.id}
                  ref={active ? activeStepRef : undefined}
                  className={`card relative flex items-center gap-3 overflow-hidden p-3 transition ${
                    active ? 'border-brand ring-1 ring-brand/40' : passed ? 'opacity-60' : ''
                  } scroll-mt-44`}
                >
                  {/* Elapsed-time fill overlay */}
                  <div
                    className={`absolute inset-y-0 left-0 ${passed ? 'bg-accent/10' : 'bg-brand/15'}`}
                    style={{ width: `${fill * 100}%` }}
                    aria-hidden
                  />
                  {/* Extra overlay: the active pour fills its "finalize pour" zone,
                      with a marker showing where pouring should be finished. */}
                  {active && pFrac > 0 && (
                    <>
                      <div
                        className="absolute inset-y-0 left-0 bg-accent/30"
                        style={{ width: `${Math.min(fill, pFrac) * 100}%` }}
                        aria-hidden
                      />
                      <div
                        className="absolute inset-y-0 w-0.5 bg-accent"
                        style={{ left: `${pFrac * 100}%` }}
                        aria-hidden
                      />
                    </>
                  )}
                  <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">
                    {passed ? <Check size={14} className="text-accent" /> : i + 1}
                  </span>
                  <span className={`relative flex-1 ${active ? 'font-semibold' : ''}`}>{stepLabel(s, t)}</span>
                  <span className="relative flex shrink-0 flex-col items-end leading-tight">
                    {cumWater[i] > 0 && (
                      <span className="tabular-nums text-sm font-semibold text-brand">{cumWater[i]} g</span>
                    )}
                    <span className="tabular-nums text-xs text-muted">{formatSeconds(s.atTimeSec)}</span>
                  </span>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </div>
  )
}
