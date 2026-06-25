import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Play, Square, RotateCcw, Check, X } from 'lucide-react'
import { db } from '@/db/dexie'
import { PageHeader, Field } from '@/components/ui'
import { cue, useWakeLock } from '@/lib/feedback'
import { PressureCurve } from '@/components/PressureCurve'

/**
 * Guided espresso shot timer. A stripped-down sibling of the brew player: a
 * single continuous clock with two phases (pre-infusion → extraction) and a
 * highlighted target window around the recipe's shot time. On stop it captures
 * the real shot time and pulled yield and hands them to the log page, which
 * feeds the dial-in card a measured shot instead of a hand-typed guess.
 *
 * Unlike the brew player this isn't persisted across navigation — a shot is ~30s
 * and you're standing at the machine; if you leave, you re-pull. Keeping it local
 * avoids stepping on the single persisted guided brew.
 */
export default function EspressoShotPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const recipe = useLiveQuery(() => (id ? db.recipes.get(id) : undefined), [id])

  // null = not started; while running we derive elapsed from the wall clock.
  const [startedAt, setStartedAt] = useState<number | null>(null)
  // Frozen final elapsed once the shot is stopped (null while idle/running).
  const [stoppedSec, setStoppedSec] = useState<number | null>(null)
  const [yieldOut, setYieldOut] = useState('')

  const running = startedAt != null && stoppedSec == null

  // Re-render ~10×/s while running so the clock and phase update smoothly.
  const [, tick] = useReducer((c) => c + 1, 0)
  useEffect(() => {
    if (!running) return
    const iv = window.setInterval(tick, 100)
    return () => window.clearInterval(iv)
  }, [running])

  useWakeLock(running)

  const elapsed =
    stoppedSec != null ? stoppedSec : startedAt != null ? (Date.now() - startedAt) / 1000 : 0

  // Optional staged pressure profile. When present it drives a per-stage overlay
  // (label · target bar) and the shot total falls out of the summed stage times.
  const profile = useMemo(
    () => (recipe?.pressureProfile ?? []).filter((s) => s.sec > 0),
    [recipe?.pressureProfile],
  )
  const stageBounds = useMemo(() => {
    let acc = 0
    return profile.map((s) => (acc += s.sec))
  }, [profile])
  const profileTotal = stageBounds.length ? stageBounds[stageBounds.length - 1] : 0

  const preInf = recipe?.preInfusionSec ?? 0
  const target = recipe?.shotTimeSec ?? (profileTotal ? Math.round(profileTotal) : undefined)
  const [winLo, winHi] = target ? [target - 2, target + 2] : [0, 0]

  // Active profile stage at the current elapsed time (clamps to the last stage).
  const stageIdx = profile.length
    ? Math.min(stageBounds.findIndex((b) => elapsed < b), profile.length - 1)
    : -1
  const curStage = stageIdx >= 0 ? profile[stageIdx] : profile.length ? profile[profile.length - 1] : undefined
  const inPreInfusion = running && preInf > 0 && elapsed < preInf
  const inWindow = !!target && elapsed >= winLo && elapsed <= winHi
  const pastWindow = !!target && elapsed > winHi

  // Cue: pre-infusion → extraction handover, entering the window, and overrun.
  const passedPreInf = useRef(false)
  const enteredWindow = useRef(false)
  const passedWindow = useRef(false)
  const firedStages = useRef(0)
  // Beep at each profile stage boundary so you know when to move the lever/paddle.
  useEffect(() => {
    if (!running || !profile.length) return
    while (firedStages.current < stageBounds.length && elapsed >= stageBounds[firedStages.current]) {
      firedStages.current++
      cue(true)
    }
  }, [elapsed, running, profile.length, stageBounds])
  useEffect(() => {
    if (!running) return
    if (preInf > 0 && !passedPreInf.current && elapsed >= preInf) {
      passedPreInf.current = true
      cue()
    }
    if (target && !enteredWindow.current && elapsed >= winLo) {
      enteredWindow.current = true
      cue()
    }
    if (target && !passedWindow.current && elapsed > winHi) {
      passedWindow.current = true
      cue(true)
    }
  }, [elapsed, running, preInf, target, winLo, winHi])

  function start() {
    setStoppedSec(null)
    setStartedAt(Date.now())
    passedPreInf.current = false
    enteredWindow.current = false
    passedWindow.current = false
    firedStages.current = 0
    cue(true)
  }

  function stop() {
    if (startedAt == null) return
    setStoppedSec((Date.now() - startedAt) / 1000)
    cue(true)
  }

  function reset() {
    setStartedAt(null)
    setStoppedSec(null)
  }

  if (recipe === undefined) return null
  if (!recipe) return <p className="text-muted">Not found.</p>

  const dose = recipe.doseIn
  const ratio = recipe.ratio ?? (dose && recipe.yieldOut ? recipe.yieldOut / dose : undefined)
  const stopped = stoppedSec != null

  // Big-clock tint: amber during pre-infusion, green in the window, red past it.
  const clockCls = inPreInfusion
    ? 'text-amber-500'
    : inWindow
      ? 'text-emerald-500'
      : pastWindow
        ? 'text-red-500'
        : ''

  return (
    <div className="space-y-5">
      <PageHeader
        title={recipe.title || t('shot.title')}
        back
        action={
          <button onClick={() => navigate(`/recipe/${recipe.id}`)} className="btn-ghost !px-2" aria-label={t('common.close')}>
            <X size={18} />
          </button>
        }
      />

      {/* Target recap */}
      <div className="card flex flex-wrap items-center justify-center gap-x-4 gap-y-1 p-4 text-center text-sm">
        {dose != null && (
          <span className="font-semibold tabular-nums">
            {dose} g{recipe.yieldOut != null ? ` → ${recipe.yieldOut} g` : ''}
          </span>
        )}
        {ratio != null && <span className="text-muted tabular-nums">1:{ratio.toFixed(1)}</span>}
        {target != null && (
          <span className="text-muted tabular-nums">
            {t('shot.targetTime', { lo: winLo, hi: winHi })}
          </span>
        )}
      </div>

      {/* Big clock */}
      <div className="card flex flex-col items-center gap-2 p-8 text-center">
        <span className={`font-mono text-7xl font-bold tabular-nums ${clockCls}`}>
          {elapsed.toFixed(1)}
          <span className="text-3xl">s</span>
        </span>
        <p className="text-lg font-semibold">
          {stopped
            ? t('shot.done')
            : inPreInfusion
              ? t('shot.preinfusion')
              : running
                ? inWindow
                  ? t('shot.inWindow')
                  : pastWindow
                    ? t('shot.past')
                    : t('shot.extraction')
                : t('shot.ready')}
        </p>
        {preInf > 0 && !stopped && profile.length === 0 && (
          <p className="text-xs text-muted tabular-nums">{t('shot.preinfusionPlan', { secs: preInf })}</p>
        )}
        {curStage && !stopped && (
          <p className="text-sm font-medium tabular-nums">
            {t('shot.stage', {
              label: t('recipe.stage.' + (curStage.label ?? 'other')),
              bar: curStage.bar,
            })}
          </p>
        )}
      </div>

      {/* Pressure profile timeline with a live playhead */}
      {profile.length > 0 && (
        <div className="card p-3">
          <PressureCurve stages={profile} elapsed={running || stopped ? elapsed : 0} />
        </div>
      )}

      {/* Controls */}
      {!stopped ? (
        <button className="btn-primary w-full !py-4 text-lg" onClick={running ? stop : start}>
          {running ? <Square size={20} /> : <Play size={20} />}
          {running ? t('shot.stop') : t('shot.start')}
        </button>
      ) : (
        <div className="space-y-4">
          <Field label={t('shot.yield')} hint={t('common.optional')}>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={yieldOut}
              onChange={(e) => setYieldOut(e.target.value)}
              placeholder={recipe.yieldOut != null ? String(recipe.yieldOut) : undefined}
            />
          </Field>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={reset}>
              <RotateCcw size={18} /> {t('shot.redo')}
            </button>
            <Link
              to={`/recipe/${recipe.id}/log`}
              state={{
                actualTotalSec: Math.round(elapsed),
                beverageWeight: yieldOut === '' ? undefined : Number(yieldOut),
              }}
              className="btn-primary flex-1"
            >
              <Check size={18} /> {t('shot.logShot')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
