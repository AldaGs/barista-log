import Dexie, { type Table } from 'dexie'
import type {
  Bean,
  BrewSession,
  FlavorTag,
  Gear,
  Grinder,
  Profile,
  Recipe,
  WaterProfile,
} from './types'
import { SEED_GRINDERS } from './seedGrinders'
import { SEED_GEAR } from './seedGear'
import { SEED_RECIPES } from './seedRecipes'

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
  gear!: Table<Gear, string>
  profile!: Table<Profile, string>
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
    this.version(3).stores({
      gear: 'id, name, type, seeded, updatedAt, dirty',
    })
    this.version(4).stores({
      recipes: 'id, title, method, beanId, forkedFromId, updatedAt, dirty',
    })
    this.version(5).stores({
      profile: 'id, updatedAt, dirty',
    })
    // The profile singleton briefly used the non-UUID id 'me', which the cloud
    // rejects (sync_records.id is uuid). Drop that stale row so it stops failing.
    this.version(6).upgrade((tx) => tx.table('profile').delete('me'))
  }
}

export const db = new BaristaDB()

/** localStorage marker so starter recipes seed exactly once per device. */
const RECIPE_SEED_FLAG = 'slurry-seeded-recipes'

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

  // Seed common brewers once (names are stable, so no reconcile needed).
  if ((await db.gear.count()) === 0) {
    await db.gear.bulkAdd(
      SEED_GEAR.map((g) => ({
        ...g,
        id: uid(),
        seeded: 1,
        dirty: 0,
        syncedAt: null,
        createdAt: ts,
        updatedAt: ts,
      })),
    )
  }

  // Seed starter recipes once per device so a brand-new app isn't empty. Gated
  // by a flag (not just an empty count) so they never come back after the user
  // deletes them, and kept local (dirty: 0) so they don't sync to the cloud.
  if (!localStorage.getItem(RECIPE_SEED_FLAG) && (await db.recipes.count()) === 0) {
    const gearByName = new Map((await db.gear.toArray()).map((g) => [g.name, g.id]))
    await db.recipes.bulkAdd(
      SEED_RECIPES.map(({ gearName, steps, ...r }) => ({
        ...r,
        id: uid(),
        gearId: gearName ? gearByName.get(gearName) : undefined,
        steps: steps?.map((s) => ({ ...s, id: uid() })),
        dirty: 0,
        syncedAt: null,
        createdAt: ts,
        updatedAt: ts,
      })) as Recipe[],
    )
    localStorage.setItem(RECIPE_SEED_FLAG, '1')
  }
}
