import type { Recipe } from '@/db/types'

/**
 * Scale a recipe up or down while keeping its ratio, times and temperatures
 * fixed — only the masses move. Useful for brewing a bigger batch or a single
 * cup from a recipe you dialed at a different dose. Nothing is persisted; this
 * returns a new partial you can read off or save as a fresh recipe.
 *
 * Everything that is a mass of coffee or water scales by the same factor:
 * dose, yield, each pour's water, a hot bloom, and any ice. Grind, temperature,
 * pressure and the whole time schedule stay put — they don't change with batch
 * size.
 */

const round = (v: number | undefined, dp = 1): number | undefined => {
  if (v == null) return undefined
  const f = 10 ** dp
  return Math.round(v * f) / f
}

export interface ScaledRecipe {
  factor: number
  doseIn?: number
  yieldOut?: number
  steps?: Recipe['steps']
  hotBloom?: Recipe['hotBloom']
  iceGrams?: number
}

/** Scale every mass field of a recipe by `factor` (> 0). */
export function scaleByFactor(r: Partial<Recipe>, factor: number): ScaledRecipe {
  const f = factor > 0 ? factor : 1
  return {
    factor: f,
    doseIn: round(r.doseIn != null ? r.doseIn * f : undefined),
    yieldOut: round(r.yieldOut != null ? r.yieldOut * f : undefined, 0),
    steps: r.steps?.map((s) => ({ ...s, water: round(s.water != null ? s.water * f : undefined, 0) })),
    hotBloom: r.hotBloom
      ? { ...r.hotBloom, water: round(r.hotBloom.water * f, 0) ?? r.hotBloom.water }
      : undefined,
    iceGrams: round(r.iceGrams != null ? r.iceGrams * f : undefined, 0),
  }
}

/** Scale a recipe so its dose becomes `targetDose` grams. */
export function scaleToDose(r: Partial<Recipe>, targetDose: number): ScaledRecipe | null {
  if (!r.doseIn || r.doseIn <= 0 || targetDose <= 0) return null
  return scaleByFactor(r, targetDose / r.doseIn)
}

/** Scale a recipe so its total water (yield, for brew) becomes `targetWater`. */
export function scaleToWater(r: Partial<Recipe>, targetWater: number): ScaledRecipe | null {
  if (!r.yieldOut || r.yieldOut <= 0 || targetWater <= 0) return null
  return scaleByFactor(r, targetWater / r.yieldOut)
}
