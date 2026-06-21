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
  return [t('step.' + s.type), s.water != null ? `${s.water} g` : null, s.note].filter(Boolean).join(' · ')
}

export default function BrewPlayPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const recipe = useLiveQuery(() => (id ? db.recipes.get(id) : undefined), [id])

  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const ref = useRef<number | null>(null)

  useEffect(() => {
    if (running) ref.current = window.setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => {
      if (ref.current) window.clearInterval(ref.current)
    }
  }, [running])

  const steps = useMemo(
    () => [...(recipe?.steps ?? [])].sort((a, b) => (a.atTimeSec ?? 0) - (b.atTimeSec ?? 0)),
    [recipe?.steps],
  )

  // Active step = the last step whose start time has been reached.
  const activeIndex = useMemo(() => {
    let idx = -1
    steps.forEach((s, i) => {
      if ((s.atTimeSec ?? 0) <= elapsed) idx = i
    })
    return idx
  }, [steps, elapsed])

  // Keep the screen awake while brewing; beep/vibrate when a step triggers.
  useWakeLock(running)
  const prevActive = useRef(-1)
  useEffect(() => {
    if (activeIndex !== prevActive.current) {
      if (running && activeIndex >= 0) cue(activeIndex === steps.length - 1)
      prevActive.current = activeIndex
    }
  }, [activeIndex, running, steps.length])

  const nextStep = steps[activeIndex + 1]
  const countdown = nextStep ? (nextStep.atTimeSec ?? 0) - elapsed : null
  const cumulativeWater = steps
    .slice(0, activeIndex + 1)
    .reduce((sum, s) => sum + (s.water ?? 0), 0)

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
          <div className="card flex flex-col items-center gap-2 p-6 text-center">
            <span className="font-mono text-5xl tabular-nums">{formatSeconds(elapsed)}</span>
            {activeIndex >= 0 ? (
              <p className="text-lg font-semibold">{stepLabel(steps[activeIndex], t)}</p>
            ) : (
              <p className="text-muted">{t('play.start')}…</p>
            )}
            {cumulativeWater > 0 && (
              <p className="text-sm text-muted">{cumulativeWater} g</p>
            )}
            {nextStep && (
              <p className="mt-1 text-sm text-muted">
                {t('play.next')}: {stepLabel(nextStep, t)}
                {countdown != null && countdown > 0 && (
                  <span className="ml-2 font-semibold text-brand">{t('play.now')} +{countdown}s</span>
                )}
              </p>
            )}
            {!nextStep && activeIndex === steps.length - 1 && (
              <p className="mt-1 font-semibold text-accent">{t('play.complete')}</p>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={() => setRunning((r) => !r)}>
              {running ? <Pause size={18} /> : <Play size={18} />}
              {running ? t('play.pause') : elapsed > 0 ? t('play.resume') : t('play.start')}
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                setRunning(false)
                setElapsed(0)
              }}
            >
              <RotateCcw size={18} /> {t('play.reset')}
            </button>
          </div>

          {/* Finish → log this brew */}
          <Link
            to={`/recipe/${recipe.id}/log`}
            className={activeIndex >= steps.length - 1 && elapsed > 0 ? 'btn-primary w-full' : 'btn-ghost w-full'}
          >
            <Check size={18} /> {t('session.logBrew')}
          </Link>

          {/* Step list */}
          <ol className="space-y-2">
            {steps.map((s, i) => {
              const passed = i < activeIndex
              const active = i === activeIndex
              return (
                <li
                  key={s.id}
                  className={`card flex items-center gap-3 p-3 transition ${
                    active ? 'border-brand ring-1 ring-brand/40' : passed ? 'opacity-60' : ''
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">
                    {passed ? <Check size={14} className="text-accent" /> : i + 1}
                  </span>
                  <span className={`flex-1 ${active ? 'font-semibold' : ''}`}>{stepLabel(s, t)}</span>
                  <span className="tabular-nums text-sm text-muted">{formatSeconds(s.atTimeSec)}</span>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </div>
  )
}
