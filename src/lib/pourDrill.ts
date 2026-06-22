import { useEffect, useMemo, useRef, useState } from 'react'
import type { FlowRate, PourPattern, Recipe } from '@/db/types'
import { cue } from '@/lib/feedback'

/** One step of a pour drill: either an active pour or a rest/wait. */
export interface DrillSegment {
  kind: 'pour' | 'wait'
  seconds: number
  /** grams poured during a pour segment (for the running total) */
  water?: number
  pattern?: PourPattern
  label?: string
}

/** A pour duration (s) for `water` grams at flow rate `rate` (g/s). */
export function pourSeconds(water: number, rate: number): number {
  return rate > 0 ? Math.round((water / rate) * 10) / 10 : 0
}

/**
 * Build a free-practice drill: `pulses` equal pours of `water/pulses` grams
 * each, separated by `rest` seconds, all using `pattern` at `rate` g/s.
 */
export function buildPulseDrill(opts: {
  water: number
  pulses: number
  rest: number
  rate: number
  pattern: PourPattern
}): DrillSegment[] {
  const pulses = Math.max(1, Math.round(opts.pulses))
  const perPulse = opts.water / pulses
  const dur = pourSeconds(perPulse, opts.rate)
  const segs: DrillSegment[] = []
  for (let i = 0; i < pulses; i++) {
    segs.push({ kind: 'pour', seconds: dur, water: perPulse, pattern: opts.pattern })
    if (i < pulses - 1 && opts.rest > 0) segs.push({ kind: 'wait', seconds: opts.rest })
  }
  return segs
}

/**
 * Reconstruct a drill from a saved recipe's steps. Each step's `atTimeSec` is
 * the moment it should be finished (matching the brew player), so a step runs
 * from the previous step's time up to its own. Pour/bloom steps spend as much
 * of that window as their flow rate needs, then wait out the remainder.
 */
export function buildRecipeDrill(recipe: Recipe, rates: Record<FlowRate, number>): DrillSegment[] {
  const steps = [...(recipe.steps ?? [])].sort((a, b) => (a.atTimeSec ?? 0) - (b.atTimeSec ?? 0))
  const segs: DrillSegment[] = []
  let prev = 0
  for (const s of steps) {
    const at = s.atTimeSec ?? prev
    const window = Math.max(0, at - prev)
    const isPour = (s.type === 'pour' || s.type === 'bloom') && !!s.water && s.water > 0
    if (isPour) {
      const rate = rates[s.flowRate ?? 'medium'] || rates.medium
      const dur = Math.min(window || pourSeconds(s.water!, rate), pourSeconds(s.water!, rate))
      segs.push({ kind: 'pour', seconds: dur, water: s.water, pattern: s.pourPattern, label: s.type })
      const restAfter = window - dur
      if (restAfter > 0.4) segs.push({ kind: 'wait', seconds: Math.round(restAfter * 10) / 10 })
    } else if (window > 0) {
      segs.push({ kind: 'wait', seconds: window, label: s.type })
    }
    prev = at
  }
  return segs
}

/** Index of the segment active at elapsed time `e` (segments.length once done). */
export function segmentAt(segments: DrillSegment[], e: number): number {
  let acc = 0
  for (let i = 0; i < segments.length; i++) {
    acc += segments[i].seconds
    if (e < acc) return i
  }
  return segments.length
}

export interface DrillRun {
  running: boolean
  done: boolean
  elapsed: number
  total: number
  index: number
  segElapsed: number
  segRemaining: number
  start: () => void
  pause: () => void
  reset: () => void
}

/**
 * Wall-clock drill engine. Beeps a strong cue at each pour start (and the
 * finish), a soft cue when a rest begins, and an optional per-second metronome
 * tick through pour segments to train pace. Best-effort audio + haptics.
 */
export function usePourDrill(segments: DrillSegment[], metronome = true): DrillRun {
  const total = useMemo(() => segments.reduce((s, x) => s + x.seconds, 0), [segments])

  // Precompute every cue time once: segment boundaries + in-pour metronome ticks.
  const cues = useMemo(() => {
    const list: { t: number; strong: boolean }[] = []
    let start = 0
    for (const seg of segments) {
      list.push({ t: start, strong: seg.kind === 'pour' })
      if (metronome && seg.kind === 'pour') {
        for (let s = Math.ceil(start + 0.001); s < start + seg.seconds - 0.05; s++) {
          list.push({ t: s, strong: false })
        }
      }
      start += seg.seconds
    }
    list.push({ t: total, strong: true })
    return list.sort((a, b) => a.t - b.t)
  }, [segments, metronome, total])

  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(0)
  const startedAt = useRef(0)
  const baseElapsed = useRef(0)
  const fired = useRef(0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return
    const loop = () => {
      const e = Math.min(total, baseElapsed.current + (performance.now() - startedAt.current) / 1000)
      elapsedRef.current = e
      setElapsed(e)
      while (fired.current < cues.length && cues[fired.current].t <= e + 1e-3) {
        cue(cues[fired.current].strong)
        fired.current++
      }
      if (e >= total) {
        setRunning(false)
        return
      }
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [running, total, cues])

  const start = () => {
    if (running || total === 0) return
    if (elapsedRef.current >= total) {
      elapsedRef.current = 0
      baseElapsed.current = 0
      fired.current = 0
      setElapsed(0)
    } else {
      baseElapsed.current = elapsedRef.current
    }
    startedAt.current = performance.now()
    setRunning(true)
  }
  const pause = () => {
    baseElapsed.current = elapsedRef.current
    setRunning(false)
  }
  const reset = () => {
    setRunning(false)
    elapsedRef.current = 0
    baseElapsed.current = 0
    fired.current = 0
    setElapsed(0)
  }

  const index = segmentAt(segments, elapsed)
  const segStart = segments.slice(0, index).reduce((s, x) => s + x.seconds, 0)
  const segElapsed = elapsed - segStart
  const cur = segments[index]
  const segRemaining = cur ? Math.max(0, cur.seconds - segElapsed) : 0

  return {
    running,
    done: elapsed >= total && total > 0,
    elapsed,
    total,
    index,
    segElapsed,
    segRemaining,
    start,
    pause,
    reset,
  }
}
