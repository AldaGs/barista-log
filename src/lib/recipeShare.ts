import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { db } from '@/db/dexie'
import { saveRecipe, saveBean, saveGear, saveGrinder, saveWater } from '@/db/repo'
import type { Bean, Gear, Grinder, Recipe, WaterProfile } from '@/db/types'

/**
 * Peer-to-peer recipe sharing with no backend: the recipe and its referenced
 * bean/gear/grinder/water are bundled into a compressed payload that travels
 * inside a link fragment or QR code. The recipient decodes it locally and
 * imports — adding any bundled entities to their own libraries.
 */

const VERSION = 1

type SharedRecipe = Omit<Recipe, keyof Recipe & ('id' | 'dirty' | 'syncedAt' | 'createdAt' | 'updatedAt' | 'beanId' | 'gearId' | 'grinderId' | 'waterId' | 'forkedFromId')>
type SharedBean = Pick<Bean, 'name' | 'roaster' | 'origin' | 'process' | 'roastLevel' | 'roastDate' | 'notes'>
type SharedGear = Pick<Gear, 'name' | 'type' | 'brand' | 'notes'>
type SharedGrinder = Pick<Grinder, 'name' | 'type' | 'burr' | 'micronsPerClick' | 'zeroOffsetClicks' | 'maxClicks' | 'source' | 'estimated'>
type SharedWater = Pick<WaterProfile, 'name' | 'supplier' | 'tds' | 'gh' | 'kh' | 'notes'>

export interface SharePayload {
  v: number
  recipe: SharedRecipe
  bean?: SharedBean
  gear?: SharedGear
  grinder?: SharedGrinder
  water?: SharedWater
}

const clean = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')) as T

/** Gather a recipe and its referenced entities into a self-contained payload. */
export async function buildSharePayload(recipe: Recipe): Promise<SharePayload> {
  const {
    id: _id, dirty: _d, syncedAt: _s, createdAt: _c, updatedAt: _u,
    beanId, gearId, grinderId, waterId, forkedFromId: _f,
    ...recipeFields
  } = recipe

  const bean = beanId ? await db.beans.get(beanId) : undefined
  const gear = gearId ? await db.gear.get(gearId) : undefined
  const grinder = grinderId ? await db.grinders.get(grinderId) : undefined
  const water = waterId ? await db.waters.get(waterId) : undefined

  return clean({
    v: VERSION,
    recipe: clean(recipeFields) as SharedRecipe,
    bean: bean && clean({ name: bean.name, roaster: bean.roaster, origin: bean.origin, process: bean.process, roastLevel: bean.roastLevel, roastDate: bean.roastDate, notes: bean.notes }),
    gear: gear && clean({ name: gear.name, type: gear.type, brand: gear.brand, notes: gear.notes }),
    grinder: grinder && clean({ name: grinder.name, type: grinder.type, burr: grinder.burr, micronsPerClick: grinder.micronsPerClick, zeroOffsetClicks: grinder.zeroOffsetClicks, maxClicks: grinder.maxClicks, source: grinder.source, estimated: grinder.estimated }),
    water: water && clean({ name: water.name, supplier: water.supplier, tds: water.tds, gh: water.gh, kh: water.kh, notes: water.notes }),
  })
}

export function encodePayload(p: SharePayload): string {
  return compressToEncodedURIComponent(JSON.stringify(p))
}

export function decodePayload(code: string): SharePayload | null {
  try {
    const json = decompressFromEncodedURIComponent(code)
    if (!json) return null
    const p = JSON.parse(json) as SharePayload
    if (!p?.recipe || !p.recipe.method) return null
    return p
  } catch {
    return null
  }
}

/** Build the full importable URL for a payload. */
export function shareUrl(code: string): string {
  return `${location.origin}/import#${code}`
}

const sameName = (a?: string, b?: string) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

/**
 * Import a payload: match referenced entities to the user's libraries by name
 * (creating any that are missing), then create the recipe. Returns its id.
 */
export async function importPayload(p: SharePayload): Promise<string> {
  let beanId: string | undefined
  if (p.bean) {
    const existing = (await db.beans.toArray()).find(
      (b) => sameName(b.name, p.bean!.name) && sameName(b.roaster, p.bean!.roaster),
    )
    beanId = existing?.id ?? (await saveBean(p.bean))
  }

  let gearId: string | undefined
  if (p.gear) {
    const existing = (await db.gear.toArray()).find(
      (g) => sameName(g.name, p.gear!.name) && g.type === p.gear!.type,
    )
    gearId = existing?.id ?? (await saveGear(p.gear))
  }

  let grinderId: string | undefined
  if (p.grinder) {
    const existing = (await db.grinders.toArray()).find((g) => sameName(g.name, p.grinder!.name))
    grinderId = existing?.id ?? (await saveGrinder(p.grinder))
  }

  let waterId: string | undefined
  if (p.water) {
    const existing = (await db.waters.toArray()).find((w) => sameName(w.name, p.water!.name))
    waterId = existing?.id ?? (await saveWater(p.water))
  }

  return saveRecipe({
    ...p.recipe,
    title: p.recipe.title || '',
    method: p.recipe.method,
    beanId,
    gearId,
    grinderId,
    waterId,
  })
}
