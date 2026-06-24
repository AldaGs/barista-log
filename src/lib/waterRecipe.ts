/**
 * Water recipe builder — turn a target water profile into a DIY mineral recipe
 * you mix yourself from distilled / RO water. No hardware needed: it's the same
 * directional "opinion engine" philosophy as the rest of the app, grounded in
 * the standard hardness chemistry rather than a calibrated lab measurement.
 *
 * Two minerals cover the everyday espresso/filter case:
 *  - Epsom salt (magnesium sulfate, MgSO₄·7H₂O) → adds GH (general hardness),
 *    the "extraction" mineral that grabs flavour compounds.
 *  - Baking soda (sodium bicarbonate, NaHCO₃) → adds KH (alkalinity / buffer),
 *    which tames acidity and protects the machine from corrosion.
 *
 * Hardness & alkalinity are expressed in ppm as CaCO₃, the convention coffee
 * water guides use (Barista Hustle, SCA). The math is exact stoichiometry:
 *
 *   1 mol divalent cation  ≡ 1 mol CaCO₃        (100.09 g)  → GH
 *   1 mol HCO₃⁻            ≡ 0.5 mol CaCO₃      (50.04 g)   → KH
 */

/** mg of Epsom salt per litre to raise GH by 1 ppm-as-CaCO₃.
 *  MgSO₄·7H₂O = 246.5 g/mol; 1 mol Mg²⁺ ≡ 100.09 g CaCO₃ → 246.5/100.09 ≈ 2.463 */
export const EPSOM_MG_PER_PPM_GH_PER_L = 246.5 / 100.09

/** mg of baking soda per litre to raise KH by 1 ppm-as-CaCO₃.
 *  NaHCO₃ = 84.01 g/mol; 1 mol HCO₃⁻ ≡ 50.04 g CaCO₃ → 84.01/50.04 ≈ 1.679 */
export const BICARB_MG_PER_PPM_KH_PER_L = 84.01 / 50.04

export interface WaterTarget {
  /** general hardness, ppm as CaCO₃ */
  gh: number
  /** carbonate hardness / alkalinity, ppm as CaCO₃ */
  kh: number
}

export interface MineralDose {
  /** grams of Epsom salt to dissolve in the whole batch */
  epsomG: number
  /** grams of baking soda to dissolve in the whole batch */
  bicarbG: number
  /** total dissolved solids the recipe adds, ppm (rough sum of both salts) */
  addedTds: number
}

const round = (v: number, dp: number) => {
  const f = 10 ** dp
  return Math.round(v * f) / f
}

/**
 * Direct-dose recipe: grams of each mineral to add to `litres` of distilled/RO
 * water to hit the target GH/KH. Rounded to 0.01 g — fine for a 0.01 g scale;
 * for small batches the concentrate method (see makeConcentratePlan) is easier.
 */
export function mineralRecipe(target: WaterTarget, litres: number): MineralDose {
  const L = Math.max(0, litres)
  const epsomMg = Math.max(0, target.gh) * EPSOM_MG_PER_PPM_GH_PER_L * L
  const bicarbMg = Math.max(0, target.kh) * BICARB_MG_PER_PPM_KH_PER_L * L
  // Added TDS ≈ the mass of salts dissolved per litre (mg/L = ppm).
  const addedTds = L > 0 ? round((epsomMg + bicarbMg) / L, 0) : 0
  return {
    epsomG: round(epsomMg / 1000, 2),
    bicarbG: round(bicarbMg / 1000, 2),
    addedTds,
  }
}

/** Invert a direct dose back to the GH/KH it yields in `litres` of water. */
export function recipeToProfile(dose: { epsomG: number; bicarbG: number }, litres: number): WaterTarget {
  const L = Math.max(1e-6, litres)
  return {
    gh: round((dose.epsomG * 1000) / EPSOM_MG_PER_PPM_GH_PER_L / L, 0),
    kh: round((dose.bicarbG * 1000) / BICARB_MG_PER_PPM_KH_PER_L / L, 0),
  }
}

export interface ConcentratePlan {
  /** grams of salt to dissolve in 1 L to make the stock concentrate */
  epsomStockG: number
  bicarbStockG: number
  /** mL of each concentrate to add per litre of final brew water */
  epsomMlPerL: number
  bicarbMlPerL: number
}

/**
 * Concentrate (Rao/Perger-style) plan: instead of weighing tiny amounts each
 * time, dissolve a fixed mass in 1 L of water once, then dose a few mL per litre.
 * We fix the stock at `stockG` grams/L (default 5 g — easy to weigh) and derive
 * the mL needed so the final water lands on target.
 */
export function makeConcentratePlan(target: WaterTarget, stockG = 5): ConcentratePlan {
  // ppm contributed per mL of a `stockG`-per-litre concentrate added to 1 L:
  //   (stockG g / 1000 mL) × 1 mL = stockG mg added to 1 L → stockG mg/L,
  //   converted to ppm GH/KH via the same coefficients.
  const ghPerMl = stockG / EPSOM_MG_PER_PPM_GH_PER_L
  const khPerMl = stockG / BICARB_MG_PER_PPM_KH_PER_L
  return {
    epsomStockG: stockG,
    bicarbStockG: stockG,
    epsomMlPerL: round(target.gh / ghPerMl, 1),
    bicarbMlPerL: round(target.kh / khPerMl, 1),
  }
}

/**
 * A few well-known target profiles, ppm as CaCO₃. Directional starting points,
 * not gospel — labelled by who popularised them.
 */
export const WATER_PRESETS: { id: string; gh: number; kh: number }[] = [
  { id: 'sca', gh: 68, kh: 40 }, // SCA target (mid of the acceptable box)
  { id: 'rao', gh: 80, kh: 40 }, // Rao/Perger balanced
  { id: 'hoffmann', gh: 50, kh: 25 }, // brighter, low-buffer filter water
  { id: 'espresso', gh: 90, kh: 50 }, // fuller body, more buffer for espresso
]
