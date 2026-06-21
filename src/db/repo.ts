import { db, now, uid } from './dexie'
import type {
  Bean,
  BrewSession,
  Grinder,
  Recipe,
  WaterProfile,
} from './types'
import { triggerSync } from '@/sync/syncManager'

/** Record a tombstone and remove locally, so the delete reaches the cloud. */
async function deleteWithTombstone(collection: string, id: string) {
  await db.transaction('rw', db.table(collection), db.deletions, async () => {
    await db.table(collection).delete(id)
    await db.deletions.put({ id, collection, updatedAt: now() })
  })
  triggerSync()
}

type NewMeta = { id: string; dirty: number; syncedAt: null; createdAt: number; updatedAt: number }

function freshMeta(): NewMeta {
  const ts = now()
  return { id: uid(), dirty: 1, syncedAt: null, createdAt: ts, updatedAt: ts }
}

/** Recompute ratio = yield / dose when both present. */
export function withRatio<T extends Partial<Recipe>>(r: T): T {
  if (r.doseIn && r.yieldOut) {
    return { ...r, ratio: Math.round((r.yieldOut / r.doseIn) * 100) / 100 }
  }
  return r
}

// ---- Recipes -------------------------------------------------------------
export async function saveRecipe(
  data: Omit<Recipe, keyof NewMeta> & Partial<Pick<Recipe, 'id'>>,
): Promise<string> {
  const ratio = withRatio(data)
  let id: string
  if (data.id) {
    await db.recipes.update(data.id, { ...ratio, dirty: 1, updatedAt: now() })
    id = data.id
  } else {
    const rec = { ...freshMeta(), ...ratio } as Recipe
    await db.recipes.add(rec)
    id = rec.id
  }
  triggerSync()
  return id
}

export const latestRecipe = () =>
  db.recipes.orderBy('updatedAt').reverse().first()

export const deleteRecipe = (id: string) => deleteWithTombstone('recipes', id)

// ---- Sessions ------------------------------------------------------------
export async function saveSession(
  data: Omit<BrewSession, keyof NewMeta> & Partial<Pick<BrewSession, 'id'>>,
): Promise<string> {
  let id: string
  if (data.id) {
    await db.sessions.update(data.id, { ...data, dirty: 1, updatedAt: now() })
    id = data.id
  } else {
    const rec = { ...freshMeta(), ...data } as BrewSession
    await db.sessions.add(rec)
    id = rec.id
  }
  triggerSync()
  return id
}

export const deleteSession = (id: string) => deleteWithTombstone('sessions', id)

// ---- Beans ---------------------------------------------------------------
export async function saveBean(
  data: Omit<Bean, keyof NewMeta> & Partial<Pick<Bean, 'id'>>,
): Promise<string> {
  let id: string
  if (data.id) {
    await db.beans.update(data.id, { ...data, dirty: 1, updatedAt: now() })
    id = data.id
  } else {
    const rec = { ...freshMeta(), ...data } as Bean
    await db.beans.add(rec)
    id = rec.id
  }
  triggerSync()
  return id
}
export const deleteBean = (id: string) => deleteWithTombstone('beans', id)

// ---- Water ---------------------------------------------------------------
export async function saveWater(
  data: Omit<WaterProfile, keyof NewMeta> & Partial<Pick<WaterProfile, 'id'>>,
): Promise<string> {
  let id: string
  if (data.id) {
    await db.waters.update(data.id, { ...data, dirty: 1, updatedAt: now() })
    id = data.id
  } else {
    const rec = { ...freshMeta(), ...data } as WaterProfile
    await db.waters.add(rec)
    id = rec.id
  }
  triggerSync()
  return id
}
export const deleteWater = (id: string) => deleteWithTombstone('waters', id)

// ---- Grinders ------------------------------------------------------------
export async function saveGrinder(
  data: Omit<Grinder, keyof NewMeta | 'seeded'> & Partial<Pick<Grinder, 'id' | 'seeded'>>,
): Promise<string> {
  let id: string
  if (data.id) {
    await db.grinders.update(data.id, { ...data, dirty: 1, updatedAt: now() })
    id = data.id
  } else {
    const rec = { ...freshMeta(), seeded: 0, ...data } as Grinder
    await db.grinders.add(rec)
    id = rec.id
  }
  triggerSync()
  return id
}
export const deleteGrinder = (id: string) => deleteWithTombstone('grinders', id)
