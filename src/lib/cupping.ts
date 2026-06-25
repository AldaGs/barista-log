import type { Cupping } from '@/db/types'

/** Quality attributes scored 6.00–10.00 in 0.25 steps. */
export const QUALITY_ATTRS = [
  'fragrance',
  'flavor',
  'aftertaste',
  'acidity',
  'body',
  'balance',
  'overall',
] as const

/** 5-cup attributes, stored 0–10 (clean cups × 2). */
export const CUP_ATTRS = ['uniformity', 'cleanCup', 'sweetness'] as const

export type QualityAttr = (typeof QUALITY_ATTRS)[number]
export type CupAttr = (typeof CUP_ATTRS)[number]

/** Default per-attribute starting scores: 6.00 quality, 10 (all cups clean). */
export const DEFAULT_QUALITY = 6
export const DEFAULT_CUP = 10

/**
 * SCA total out of 100: sum of the seven quality attributes (default 6 each) and
 * the three 5-cup attributes (default 10 each), minus any defect points.
 */
export function cuppingScore(c: Partial<Cupping>): number {
  const quality = QUALITY_ATTRS.reduce((sum, k) => sum + (c[k] ?? DEFAULT_QUALITY), 0)
  const cups = CUP_ATTRS.reduce((sum, k) => sum + (c[k] ?? DEFAULT_CUP), 0)
  return Math.round((quality + cups - (c.defects ?? 0)) * 100) / 100
}
