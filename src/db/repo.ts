import { db, now, uid } from './dexie'
import type {
  Bean,
  BrewSession,
  Grinder,
  Recipe,
  WaterProfile,
} from './types'

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
  if (data.id) {
    await db.recipes.update(data.id, { ...ratio, dirty: 1, updatedAt: now() })
    return data.id
  }
  const rec = { ...freshMeta(), ...ratio } as Recipe
  await db.recipes.add(rec)
  return rec.id
}

export const latestRecipe = () =>
  db.recipes.orderBy('updatedAt').reverse().first()

export const deleteRecipe = (id: string) => db.recipes.delete(id)

// ---- Sessions ------------------------------------------------------------
export async function saveSession(
  data: Omit<BrewSession, keyof NewMeta> & Partial<Pick<BrewSession, 'id'>>,
): Promise<string> {
  if (data.id) {
    await db.sessions.update(data.id, { ...data, dirty: 1, updatedAt: now() })
    return data.id
  }
  const rec = { ...freshMeta(), ...data } as BrewSession
  await db.sessions.add(rec)
  return rec.id
}

export const deleteSession = (id: string) => db.sessions.delete(id)

// ---- Beans ---------------------------------------------------------------
export async function saveBean(
  data: Omit<Bean, keyof NewMeta> & Partial<Pick<Bean, 'id'>>,
): Promise<string> {
  if (data.id) {
    await db.beans.update(data.id, { ...data, dirty: 1, updatedAt: now() })
    return data.id
  }
  const rec = { ...freshMeta(), ...data } as Bean
  await db.beans.add(rec)
  return rec.id
}
export const deleteBean = (id: string) => db.beans.delete(id)

// ---- Water ---------------------------------------------------------------
export async function saveWater(
  data: Omit<WaterProfile, keyof NewMeta> & Partial<Pick<WaterProfile, 'id'>>,
): Promise<string> {
  if (data.id) {
    await db.waters.update(data.id, { ...data, dirty: 1, updatedAt: now() })
    return data.id
  }
  const rec = { ...freshMeta(), ...data } as WaterProfile
  await db.waters.add(rec)
  return rec.id
}
export const deleteWater = (id: string) => db.waters.delete(id)

// ---- Grinders ------------------------------------------------------------
export async function saveGrinder(
  data: Omit<Grinder, keyof NewMeta | 'seeded'> & Partial<Pick<Grinder, 'id' | 'seeded'>>,
): Promise<string> {
  if (data.id) {
    await db.grinders.update(data.id, { ...data, dirty: 1, updatedAt: now() })
    return data.id
  }
  const rec = { ...freshMeta(), seeded: 0, ...data } as Grinder
  await db.grinders.add(rec)
  return rec.id
}
export const deleteGrinder = (id: string) => db.grinders.delete(id)
