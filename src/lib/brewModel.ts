import type { BrewSession, Recipe } from '@/db/types'

/**
 * A lightweight, heuristic "brew control chart" model.
 *
 * This is NOT a physics simulation — it's an opinion engine. We estimate the
 * extraction yield (EY%) from technique (grind, temp, time, agitation, ratio),
 * then DERIVE strength (TDS%) from the mass-balance identity that links them:
 *
 *     EY%  = TDS% × beverageMass / doseMass
 *  => TDS% = EY% × doseMass / beverageMass
 *
 * So the x-axis (extraction) comes from technique and the y-axis (strength)
 * falls out of the ratio. When a user logs a measured TDS we invert the same
 * identity to plot the real point next to the estimate.
 */

export interface BrewPoint {
  /** extraction yield, % */
  extraction: number
  /** total dissolved solids, % */
  tds: number
}

/** Grams of water retained by the grounds (pour-over) — ~2 g per g of coffee. */
const RETAINED_PER_GRAM = 2

/** Ideal target windows, by method. */
export const IDEAL = {
  espresso: { ext: [18, 22] as const, tds: [8, 12] as const },
  brew: { ext: [18, 22] as const, tds: [1.15, 1.45] as const },
}

/** Plotting bounds, by method. */
export const AXIS = {
  espresso: { ext: [14, 26] as const, tds: [6, 14] as const },
  brew: { ext: [14, 26] as const, tds: [0.8, 1.8] as const },
}

/** Beverage mass in the cup (g). Uses logged value if present, else estimates. */
export function beverageWeight(p: Partial<Recipe>, override?: number): number | null {
  if (override && override > 0) return override
  if (p.method === 'espresso') return p.yieldOut ?? null
  // brew: water poured minus water retained by the grounds
  if (p.yieldOut && p.doseIn) return Math.max(p.yieldOut - p.doseIn * RETAINED_PER_GRAM, 1)
  return null
}

/**
 * Heuristic extraction-yield estimate (%). Starts from a ~20% reference brew and
 * nudges by each technique lever. Coefficients are deliberately gentle and
 * directional, not calibrated — clamped to a plausible 14–26% range.
 */
export function estimateExtraction(p: Partial<Recipe>, grinderMicronsPerClick?: number): number {
  let ey = 20

  // Water temperature: hotter extracts more (ref 93°C).
  if (p.waterTemp != null) ey += (p.waterTemp - 93) * 0.15

  // Contact time (ref: 150 s brew / 27 s espresso).
  if (p.method === 'espresso') {
    if (p.shotTimeSec) ey += (p.shotTimeSec - 27) * 0.1
    // espresso ratio (yield/dose): looser shots pull more.
    if (p.ratio) ey += (p.ratio - 2) * 5
    if (p.pressureBar) ey += (p.pressureBar - 9) * 0.1
  } else {
    if (p.totalTimeSec) ey += (p.totalTimeSec - 150) / 30 * 0.6
    // brew ratio: more solvent extracts a little more (ref 16.67).
    if (p.ratio) ey += (p.ratio - 16.67) * 0.2
    // agitation steps each bump extraction.
    const agitations = (p.steps ?? []).filter((s) => s.type === 'agitation').length
    ey += agitations * 0.5
  }

  // Grind size, only when we can resolve microns (finer = more surface = more EY).
  if (grinderMicronsPerClick && p.grindClicks) {
    const microns = p.grindClicks * grinderMicronsPerClick
    const ref = p.method === 'espresso' ? 250 : 800
    ey += (ref - microns) / 100 * 0.8
  }

  return clamp(ey, 14, 26)
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

/** Estimated (extraction, tds) point for a recipe's parameters. */
export function estimateBrew(
  p: Partial<Recipe>,
  grinderMicronsPerClick?: number,
): BrewPoint | null {
  const bev = beverageWeight(p)
  if (!p.doseIn || !bev) return null
  const extraction = estimateExtraction(p, grinderMicronsPerClick)
  const tds = (extraction * p.doseIn) / bev
  return { extraction, tds }
}

/** Measured point from a logged session, if it recorded a TDS reading. */
export function measuredBrew(s: BrewSession): BrewPoint | null {
  if (s.tds == null || s.tds <= 0) return null
  const p = s.params ?? {}
  const dose = p.doseIn
  const bev = beverageWeight(p, s.beverageWeight)
  if (!dose || !bev) return null
  const extraction = (s.tds * bev) / dose
  return { extraction, tds: s.tds }
}
