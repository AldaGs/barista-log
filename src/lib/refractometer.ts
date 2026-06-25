/**
 * Optical refractometers read °Brix (a sucrose scale), but brew strength is
 * expressed as TDS%. A coffee-specific correction factor relates the two:
 *
 *     TDS% ≈ °Brix × factor
 *
 * The common default is 0.85, but it varies with the instrument and can be
 * calibrated against a digital TDS meter — so the factor is user-configurable.
 */
export const DEFAULT_BRIX_FACTOR = 0.85

/** Convert a °Brix reading to TDS% using the coffee correction `factor`. */
export function brixToTds(brix: number, factor: number = DEFAULT_BRIX_FACTOR): number {
  return Math.round(brix * factor * 100) / 100
}
