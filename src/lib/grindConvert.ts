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

/** Rough micron bands per brew method, used as sanity rails in the UI. */
export const METHOD_MICRON_BANDS: Record<string, [number, number]> = {
  espresso: [200, 400],
  'pour-over': [400, 700],
  aeropress: [300, 600],
  'french-press': [900, 1200],
  'cold-brew': [1000, 1400],
}
