import type { Grinder } from './types'

/**
 * Seed grinder data.
 *
 * `micronsPerClick` is the size change per click/step. Conversions pivot
 * through microns: microns = clicks * micronsPerClick, so any grinder can be
 * mapped to any other without an N×N table.
 *
 * IMPORTANT — these are approximate, community/manufacturer-published values,
 * NOT lab-measured for your specific unit. Burr wear, alignment and especially
 * conical-vs-flat geometry mean two grinders at the same micron median will
 * still brew differently. Treat conversions as a STARTING POINT only.
 *
 * Sources: manufacturer specs + widely-cited community values
 * (Honest Coffee Guide, Basic Barista, beean, Home-Barista, 1Zpresso/Comandante docs).
 */
type SeedGrinder = Pick<
  Grinder,
  'name' | 'type' | 'burr' | 'micronsPerClick' | 'maxClicks' | 'source' | 'estimated'
>

export const SEED_GRINDERS: SeedGrinder[] = [
  { name: 'Timemore Chestnut C2', type: 'hand', burr: 'conical', micronsPerClick: 36, maxClicks: 36, source: 'community (~33-36µm, aligned to reference converters)' },
  { name: 'Timemore Chestnut C3 / C3S', type: 'hand', burr: 'conical', micronsPerClick: 36, maxClicks: 36, source: 'community (≈C2, mechanically near-identical)' },
  { name: 'Comandante C40 (MK4)', type: 'hand', burr: 'conical', micronsPerClick: 30, maxClicks: 40, source: 'community (~30µm/click)' },
  { name: '1Zpresso JX', type: 'hand', burr: 'conical', micronsPerClick: 25, maxClicks: 40, source: 'manufacturer' },
  { name: '1Zpresso JX-Pro', type: 'hand', burr: 'conical', micronsPerClick: 12.5, maxClicks: 50, source: 'manufacturer' },
  { name: '1Zpresso J-Max', type: 'hand', burr: 'conical', micronsPerClick: 8.8, maxClicks: 90, source: 'manufacturer' },
  { name: '1Zpresso K-Plus', type: 'hand', burr: 'conical', micronsPerClick: 22, maxClicks: 90, source: 'manufacturer' },
  { name: 'Kingrinder K6', type: 'hand', burr: 'conical', micronsPerClick: 16, maxClicks: 60, source: 'manufacturer' },
  { name: 'Baratza Encore', type: 'electric', burr: 'conical', micronsPerClick: 24, maxClicks: 40, source: 'community (~24µm, beean/HCG)' },
  { name: 'Baratza Virtuoso+', type: 'electric', burr: 'conical', micronsPerClick: 24, maxClicks: 40, source: 'community (same burrs as Encore)' },
  { name: 'Fellow Ode (Gen 2)', type: 'electric', burr: 'flat', micronsPerClick: 30, maxClicks: 33, source: 'community' },
  { name: 'DF64', type: 'electric', burr: 'flat', micronsPerClick: 25, maxClicks: 100, source: 'community (stepless, est.)', estimated: 1 },
  { name: 'Mahlkönig X54', type: 'electric', burr: 'flat', micronsPerClick: 20, maxClicks: 80, source: 'community' },
  { name: 'Eureka Mignon Specialita', type: 'electric', burr: 'flat', micronsPerClick: 10, maxClicks: 100, source: 'community (stepless, est.)', estimated: 1 },
  { name: 'Niche Zero', type: 'electric', burr: 'conical', micronsPerClick: 15, maxClicks: 50, source: 'community (stepless, est.)', estimated: 1 },
  { name: 'Wilfa Uniform', type: 'electric', burr: 'flat', micronsPerClick: 25, maxClicks: 41, source: 'community' },
]
