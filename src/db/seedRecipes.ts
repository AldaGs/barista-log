import type { BrewMethod, BrewStep, Recipe } from './types'

/** A step without its generated id — the id is assigned when seeded. */
type SeedStep = Omit<BrewStep, 'id'>

/** Starter recipes shown on first run so a brand-new app isn't empty. */
export interface SeedRecipe extends Omit<Partial<Recipe>, 'steps'> {
  title: string
  method: BrewMethod
  /** name of a seeded brewer to link as gearId, if any */
  gearName?: string
  steps?: SeedStep[]
}

export const SEED_RECIPES: SeedRecipe[] = [
  {
    title: 'Classic Espresso',
    method: 'espresso',
    doseIn: 18,
    yieldOut: 36,
    ratio: 2,
    waterTemp: 93,
    shotTimeSec: 28,
    pressureBar: 9,
    grindLabel: 'fine',
    notes: 'A balanced 1:2 starting point — dial the grind so the shot runs ~25–30s.',
  },
  {
    title: 'V60 — Single Cup',
    method: 'brew',
    brewer: 'Hario V60',
    gearName: 'Hario V60',
    doseIn: 15,
    yieldOut: 250,
    ratio: 16.67,
    waterTemp: 95,
    totalTimeSec: 165,
    bloomSec: 45,
    pours: 2,
    steps: [
      { type: 'bloom', water: 50, atTimeSec: 10, pourPattern: 'circular', flowRate: 'medium' },
      { type: 'wait', atTimeSec: 45, note: 'Let it bloom' },
      { type: 'pour', water: 100, atTimeSec: 75, pourPattern: 'circular', flowRate: 'medium' },
      { type: 'pour', water: 100, atTimeSec: 105, pourPattern: 'circular', flowRate: 'medium' },
      { type: 'drawdown', atTimeSec: 165, note: 'Aim to finish around 2:45–3:00' },
    ],
    notes: 'Hoffmann-style 1:16.7. Swirl gently after the bloom and after the last pour.',
  },
  {
    title: 'AeroPress — Everyday',
    method: 'brew',
    brewer: 'AeroPress',
    gearName: 'AeroPress',
    doseIn: 15,
    yieldOut: 220,
    ratio: 14.67,
    waterTemp: 90,
    totalTimeSec: 120,
    bloomSec: 30,
    pours: 1,
    steps: [
      { type: 'pour', water: 50, atTimeSec: 15, flowRate: 'fast', note: 'Saturate the grounds' },
      { type: 'wait', atTimeSec: 30, note: 'Bloom' },
      { type: 'pour', water: 170, atTimeSec: 50, flowRate: 'medium' },
      { type: 'wait', atTimeSec: 90, note: 'Steep' },
      { type: 'press', pressStrength: 'medium', atTimeSec: 120, note: 'Press slowly, ~30s' },
    ],
    notes: 'Standard orientation with a paper filter. Adjust steep time to taste.',
  },
  {
    title: 'Cold Brew Concentrate — Immersion',
    method: 'coldbrew',
    coldBrewStyle: 'immersion',
    brewer: 'Toddy Cold Brew',
    gearName: 'Toddy Cold Brew',
    doseIn: 100,
    yieldOut: 500, // water g
    ratio: 5, // 1:5 concentrate
    steepHours: 16,
    concentrate: 1,
    dilutionRatio: 3, // serve 1 part concentrate : 3 parts water/milk
    iceGrams: 120, // over ice in the glass
    hotBloom: { water: 100, tempC: 94, sec: 45 },
    grindLabel: 'extra coarse',
    notes:
      'Hot-bloom the bed (94°C, ~45s) to kick off degassing, then fill cold and steep 16h ' +
      'in the fridge. Yields a 1:5 concentrate — serve 1:3 over ice.',
  },
  {
    title: 'Flash Brew — Iced V60',
    method: 'coldbrew',
    coldBrewStyle: 'flash',
    brewer: 'Hario V60',
    gearName: 'Hario V60',
    doseIn: 20,
    yieldOut: 200, // hot water brewed straight onto the ice
    ratio: 15, // counting the ice melt (~100g) toward the 1:15 total
    waterTemp: 94,
    iceGrams: 100, // in the carafe before brewing
    totalTimeSec: 150,
    bloomSec: 40,
    pours: 2,
    steps: [
      { type: 'bloom', water: 50, atTimeSec: 10, pourPattern: 'circular', flowRate: 'medium' },
      { type: 'wait', atTimeSec: 40, note: 'Bloom' },
      { type: 'pour', water: 80, atTimeSec: 75, pourPattern: 'circular', flowRate: 'medium' },
      { type: 'pour', water: 70, atTimeSec: 110, pourPattern: 'circular', flowRate: 'medium' },
      { type: 'drawdown', atTimeSec: 150, note: 'Swirl to melt the last of the ice' },
    ],
    notes:
      'Japanese-style iced: brew hot straight onto 100g ice in the carafe. The reduced ' +
      'water (1:10 hot) plus the melt lands around 1:15 — bright and aromatic.',
  },
]
