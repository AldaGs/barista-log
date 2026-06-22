import type { Grinder } from '@/db/types'

export interface ConversionResult {
  microns: number
  targetClicks: number
  /** rounded to nearest practical click for display */
  targetClicksRounded: number
  /** how rough the estimate is, for the disclaimer tone */
  confidence: 'ok' | 'rough'
}

/**
 * Convert a grind setting from one grinder to another by pivoting through
 * microns. This is intentionally simple — see the disclaimer in the UI.
 *
 *   microns      = fromClicks * from.micronsPerClick
 *   targetClicks = microns / to.micronsPerClick
 *
 * Confidence drops to 'rough' across different burr geometries (conical↔flat),
 * because matching the median micron size does NOT match particle distribution.
 */
export function convertGrind(
  from: Grinder,
  fromClicks: number,
  to: Grinder,
): ConversionResult {
  const microns = fromClicks * from.micronsPerClick
  const targetClicks = microns / to.micronsPerClick
  const targetClicksRounded = Math.max(0, Math.round(targetClicks))
  const confidence: ConversionResult['confidence'] =
    from.burr === to.burr ? 'ok' : 'rough'
  return {
    microns: Math.round(microns),
    targetClicks: Math.round(targetClicks * 10) / 10,
    targetClicksRounded,
    confidence,
  }
}

/**
 * Estimated median particle size for a grind setting, in microns.
 * Returns null when we lack the data to compute it (no grinder / no clicks).
 *
 *   microns = clicks * micronsPerClick
 *
 * Same pivot the converter uses — see the disclaimer in the UI: this is a
 * rough starting point, not a lab measurement.
 */
export function estimateMicrons(
  clicks?: number | null,
  micronsPerClick?: number | null,
): number | null {
  if (clicks == null || micronsPerClick == null || !Number.isFinite(clicks)) {
    return null
  }
  return Math.round(clicks * micronsPerClick)
}

/**
 * Micron ranges per brew method, used as sanity rails in the UI
 * ("does this setting land in the espresso range?").
 * Source: Honest Coffee Guide grind-size chart.
 */
export const METHOD_MICRON_BANDS: { key: string; range: [number, number] }[] = [
  { key: 'turkish', range: [40, 220] },
  { key: 'espresso', range: [180, 380] },
  { key: 'moka', range: [360, 660] },
  { key: 'aeropress', range: [320, 960] },
  { key: 'v60', range: [400, 700] },
  { key: 'pour-over', range: [410, 930] },
  { key: 'french-press', range: [690, 1300] },
  { key: 'cold-brew', range: [800, 1400] },
]

/** Which brew methods a given micron size falls within. */
export function methodsForMicrons(microns: number): string[] {
  return METHOD_MICRON_BANDS.filter(
    ({ range }) => microns >= range[0] && microns <= range[1],
  ).map(({ key }) => key)
}
