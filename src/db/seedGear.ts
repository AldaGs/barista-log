import type { Gear } from './types'

/** Common brewers shipped so the brewer picker isn't empty. Machines are
 *  personal, so none are seeded — add your own in the Gear library. */
type SeedGear = Pick<Gear, 'name' | 'type'>

export const SEED_GEAR: SeedGear[] = [
  { name: 'Hario V60', type: 'brewer' },
  { name: 'Kalita Wave', type: 'brewer' },
  { name: 'Chemex', type: 'brewer' },
  { name: 'AeroPress', type: 'brewer' },
  { name: 'French Press', type: 'brewer' },
  { name: 'Clever Dripper', type: 'brewer' },
  { name: 'Origami', type: 'brewer' },
  { name: 'Moka Pot', type: 'brewer' },
  { name: 'Switch (Hario)', type: 'brewer' },
  { name: 'Cupping bowl', type: 'brewer' },
  // Cold brew — immersion
  { name: 'Toddy Cold Brew', type: 'brewer' },
  { name: 'Hario Mizudashi', type: 'brewer' },
  { name: 'OXO Cold Brew', type: 'brewer' },
  // Cold brew — slow drip (Kyoto / Dutch tower)
  { name: 'Yama Cold Drip Tower', type: 'brewer' },
]
