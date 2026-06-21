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
  }
}

export const db = new BaristaDB()

/** Insert shipped grinders the first time the app runs. Idempotent. */
export async function ensureSeedData() {
  const count = await db.grinders.count()
  if (count > 0) return
  const ts = now()
  await db.grinders.bulkAdd(
    SEED_GRINDERS.map((g) => ({
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
