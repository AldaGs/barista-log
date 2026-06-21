import Dexie, { type Table } from 'dexie'
import type {
  Bean,
  BrewSession,
  FlavorTag,
  Grinder,
  Recipe,
  WaterProfile,
} from './types'
import { SEED_GRINDERS } from './seedGrinders'

/** Tombstone so deletes propagate to the cloud and to other devices. */
export interface Deletion {
  id: string // same id as the deleted record
  collection: string
  updatedAt: number
}

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`)

export const now = () => Date.now()

class BaristaDB extends Dexie {
  beans!: Table<Bean, string>
  waters!: Table<WaterProfile, string>
  grinders!: Table<Grinder, string>
  recipes!: Table<Recipe, string>
  sessions!: Table<BrewSession, string>
  flavorTags!: Table<FlavorTag, string>
  deletions!: Table<Deletion, string>

  constructor() {
    super('barista-log')
    this.version(1).stores({
      beans: 'id, name, updatedAt, dirty',
      waters: 'id, name, updatedAt, dirty',
      grinders: 'id, name, seeded, updatedAt, dirty',
      recipes: 'id, title, method, beanId, updatedAt, dirty',
      sessions: 'id, recipeId, beanId, method, date, rating, dirty',
      flavorTags: 'id, label',
    })
    this.version(2).stores({
      deletions: 'id, collection, updatedAt',
    })
  }
}

export const db = new BaristaDB()

/**
 * Insert shipped grinders on first run, and reconcile reference values on later
 * runs so corrections (e.g. a fixed microns-per-click) reach existing installs.
 * Only rows we shipped (`seeded === 1`) are touched — user-added grinders and
 * user edits to custom grinders are never overwritten. Idempotent.
 */
export async function ensureSeedData() {
  const ts = now()
  const existingSeeded = await db.grinders.where('seeded').equals(1).toArray()
  const byName = new Map(existingSeeded.map((g) => [g.name, g]))

  for (const seed of SEED_GRINDERS) {
    const current = byName.get(seed.name)
    if (!current) {
      // new shipped grinder
      await db.grinders.add({
        ...seed,
        id: uid(),
        seeded: 1,
        dirty: 0,
        syncedAt: null,
        createdAt: ts,
        updatedAt: ts,
      })
    } else if (
      current.micronsPerClick !== seed.micronsPerClick ||
      current.burr !== seed.burr ||
      current.maxClicks !== seed.maxClicks ||
      current.source !== seed.source ||
      (current.estimated ?? 0) !== (seed.estimated ?? 0)
    ) {
      // refresh corrected reference data
      await db.grinders.update(current.id, { ...seed, updatedAt: ts })
    }
  }
}
