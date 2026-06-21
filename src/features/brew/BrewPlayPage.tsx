import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Play, Pause, RotateCcw, Check } from 'lucide-react'
import { db } from '@/db/dexie'
import type { BrewStep } from '@/db/types'
import { PageHeader, EmptyState } from '@/components/ui'
import { formatSeconds } from '@/lib/units'
import { cue, useWakeLock } from '@/lib/feedback'

function stepLabel(s: BrewStep, t: (k: string) => string) {
  if (s.type === 'agitation') {
    return [t('step.' + s.type), s.method && t('step.' + s.method), s.intensity && t('step.' + s.intensity)]
      .filter(Boolean)
      .join(' · ')
  }
  return [
    t('step.' + s.type),
    s.water != null ? `${s.water} g` : null,
    s.pourPattern && t('step.' + s.pourPattern),
    s.pourHeight && t('step.' + s.pourHeight),
    s.note,
  ]
    .filter(Boolean)
    .join(' · ')
}

export default function BrewPlayPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const recipe = useLiveQuery(() => (id ? db.recipes.get(id) : undefined), [id])

  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const ref = useRef<number | null>(null)

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

  useEffect(() => {
    if (running) ref.current = window.setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => {
      if (ref.current) window.clearInterval(ref.current)
    }
  }, [running])

  // Tick down the pre-start countdown, then begin the brew.
  useEffect(() => {
    if (counting == null) return
    if (counting <= 0) {
      setCounting(null)
      cue(true)
      setRunning(true)
      return
    }
    cue()
    countRef.current = window.setTimeout(() => setCounting((c) => (c == null ? null : c - 1)), 1000)
    return () => {
      if (countRef.current) window.clearTimeout(countRef.current)
    }
  }, [counting])

  function handlePlayPause() {
    if (running) {
      setRunning(false)
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
    setRunning(true)
  }

  function reset() {
    setRunning(false)
    setCounting(null)
    setElapsed(0)
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

  // Fraction [0,1] of a step's time window that has elapsed — drives the pill fill.
  const stepFill = (i: number) => {
    if (i < activeIndex) return 1
    if (i > activeIndex) return 0
    const start = i === 0 ? 0 : steps[i - 1].atTimeSec ?? 0
    const end = steps[i].atTimeSec ?? 0
    if (end <= start) return 1
    return Math.min(1, Math.max(0, (elapsed - start) / (end - start)))
  }
  const targetWater = isComplete ? cumWater[cumWater.length - 1] : cumWater[currentIndex]

  if (recipe === undefined) return null
  if (!recipe) return <p className="text-muted">Not found.</p>

  return (
    <div className="space-y-5">
      <PageHeader title={recipe.title || t('play.title')} back />

      {steps.length === 0 ? (
        <EmptyState>{t('play.noSteps')}</EmptyState>
      ) : (
        <>
          {/* Big timer + current instruction */}
          <div className="card relative flex flex-col items-center gap-2 p-6 text-center">
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
            {nextStep && (
              <p className="mt-1 text-sm text-muted">
                {t('play.next')}: {stepLabel(nextStep, t)}
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
            <button className="btn-ghost" onClick={reset}>
              <RotateCcw size={18} /> {t('play.reset')}
            </button>
          </div>

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

          {/* Finish → log this brew */}
          <Link
            to={`/recipe/${recipe.id}/log`}
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
              return (
                <li
                  key={s.id}
                  className={`card relative flex items-center gap-3 overflow-hidden p-3 transition ${
                    active ? 'border-brand ring-1 ring-brand/40' : passed ? 'opacity-60' : ''
                  }`}
                >
                  {/* Elapsed-time fill overlay */}
                  <div
                    className={`absolute inset-y-0 left-0 ${passed ? 'bg-accent/10' : 'bg-brand/15'}`}
                    style={{ width: `${fill * 100}%` }}
                    aria-hidden
                  />
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
