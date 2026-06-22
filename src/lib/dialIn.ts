import type { BrewSession, Recipe } from '@/db/types'
import type { InsightTone } from '@/lib/insights'

/**
 * Espresso dial-in assistant — an opinion engine for "what do I change next?".
 *
 * Unlike lib/insights (which judges the numbers you *entered*), this reads the
 * outcome of your *last pulled shot* and recommends the next grind/temperature
 * move, expressed in concrete clicks on your own grinder when we know its
 * µm/click. It's the same heuristic, directional philosophy as the rest of the
 * app — not a physics model.
 *
 * The dial-in loop it encodes: pull → read time & taste → adjust grind → repeat.
 *  - Shot time vs. the target window is the primary lever (it tracks flow rate,
 *    which grind controls most directly).
 *  - Once the time lands in the window, taste (acidity vs. bitterness) becomes
 *    the tie-breaker, nudging temperature and a click or two of grind.
 */

export type GrindDirection = 'finer' | 'coarser' | 'hold'

export interface DialInMove {
  grind: GrindDirection
  /** magnitude of the grind change on the user's grinder, if µm/click is known */
  clicks?: number
  /** secondary temperature nudge */
  temp?: 'up' | 'down'
  tone: InsightTone
  /** i18n key under `dialIn.*` */
  key: string
  vars?: Record<string, string | number>
}

export interface DialInResult {
  move: DialInMove
  /** what we observed, for the card to echo back */
  observed: {
    timeSec?: number
    ratio?: number
    targetTime: readonly [number, number]
  }
}

/** ~4 µm of grind change per second of shot-time error, clamped to a sane band. */
const MICRONS_PER_SEC = 4
const MIN_ADJ_MICRONS = 10
const MAX_ADJ_MICRONS = 40

/** Default target shot window (s) when the recipe doesn't pin a shot time. */
const DEFAULT_WINDOW: readonly [number, number] = [25, 30]
/** A logged score at/above this (0–5) counts as a clear taste signal. */
const STRONG_TASTE = 4

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

/** Translate a shot-time error (s) into a grind step in clicks, if resolvable. */
function clicksFor(timeErrorSec: number, micronsPerClick?: number): number | undefined {
  if (!micronsPerClick) return undefined
  const microns = clamp(Math.abs(timeErrorSec) * MICRONS_PER_SEC, MIN_ADJ_MICRONS, MAX_ADJ_MICRONS)
  return Math.max(1, Math.round(microns / micronsPerClick))
}

/**
 * Recommend the next espresso adjustment from the most recent shot. Returns
 * null for non-espresso recipes or when there's no observed shot time to react
 * to (nothing logged yet) — the caller can then prompt the user to pull one.
 */
export function dialIn(
  recipe: Partial<Recipe>,
  last: BrewSession | undefined,
  micronsPerClick?: number,
): DialInResult | null {
  if (recipe.method !== 'espresso') return null
  // Dialing reacts to an *observed* shot — with nothing logged there's nothing
  // to react to, so the card falls back to its "pull and log a shot" prompt.
  if (!last) return null

  const p = last.params ?? {}
  // Prefer what actually happened in the guided player; fall back to the shot
  // time snapshotted with the session so a hand-logged shot still works.
  const timeSec = last.actualTotalSec ?? p.shotTimeSec
  if (timeSec == null) return null

  const dose = p.doseIn ?? recipe.doseIn
  const yieldOut = last?.beverageWeight ?? p.yieldOut ?? recipe.yieldOut
  const ratio = dose && yieldOut ? yieldOut / dose : undefined

  // Target window: ±2 s around the recipe's shot time, else a default band.
  const target: readonly [number, number] = recipe.shotTimeSec
    ? [recipe.shotTimeSec - 2, recipe.shotTimeSec + 2]
    : DEFAULT_WINDOW
  const [lo, hi] = target

  const f = last?.flavors
  const observed = { timeSec, ratio, targetTime: target }

  // 1) Time is the primary lever — flow rate is mostly grind.
  if (timeSec < lo) {
    const move: DialInMove = {
      grind: 'finer',
      clicks: clicksFor(lo - timeSec, micronsPerClick),
      tone: 'warn',
      key: 'fast',
      vars: { time: Math.round(timeSec), lo, hi },
    }
    return { move, observed }
  }
  if (timeSec > hi) {
    const move: DialInMove = {
      grind: 'coarser',
      clicks: clicksFor(timeSec - hi, micronsPerClick),
      tone: 'warn',
      key: 'slow',
      vars: { time: Math.round(timeSec), lo, hi },
    }
    return { move, observed }
  }

  // 2) Time is in the window — let taste break the tie.
  if (f) {
    const sour = (f.acidity ?? 0) >= STRONG_TASTE && (f.bitterness ?? 0) < STRONG_TASTE
    const bitter = (f.bitterness ?? 0) >= STRONG_TASTE
    if (sour) {
      const move: DialInMove = {
        grind: micronsPerClick ? 'finer' : 'hold',
        clicks: micronsPerClick ? 1 : undefined,
        temp: 'up',
        tone: 'tip',
        key: 'sour',
        vars: { time: Math.round(timeSec) },
      }
      return { move, observed }
    }
    if (bitter) {
      const move: DialInMove = {
        grind: micronsPerClick ? 'coarser' : 'hold',
        clicks: micronsPerClick ? 1 : undefined,
        temp: 'down',
        tone: 'tip',
        key: 'bitter',
        vars: { time: Math.round(timeSec) },
      }
      return { move, observed }
    }
  }

  // 3) In the window and no strong taste flag — it's dialed in.
  return {
    move: { grind: 'hold', tone: 'good', key: 'dialed', vars: { time: Math.round(timeSec) } },
    observed,
  }
}
