import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { db, uid } from '@/db/dexie'
import { saveRecipe, saveBean, saveGear, saveGrinder, saveWater } from '@/db/repo'
import type { Bean, Gear, Grinder, Recipe, WaterProfile } from '@/db/types'

/**
 * Peer-to-peer recipe sharing with no backend: the recipe and its referenced
 * bean/gear/grinder/water are bundled into a compressed payload that travels
 * inside a link fragment or QR code. The recipient decodes it locally and
 * imports — adding any bundled entities to their own libraries.
 */

const VERSION = 2

// Short key maps keep the encoded payload compact so the QR stays low-density
// and easy to scan. Keys not listed pass through unchanged (no real field name
// collides with a short code, so the inverse is unambiguous).
const RECIPE_K: Record<string, string> = {
  title: 't', method: 'm', grindClicks: 'gc', grindLabel: 'gl', doseIn: 'd', yieldOut: 'y',
  ratio: 'r', waterTemp: 'wt', shotTimeSec: 'st', pressureBar: 'pb', preInfusionSec: 'pi',
  brewer: 'br', totalTimeSec: 'tt', bloomSec: 'bl', pours: 'po', steps: 's', notes: 'n',
}
const STEP_K: Record<string, string> = {
  type: 't', water: 'w', atTimeSec: 'a', intensity: 'in', method: 'me', pourPattern: 'pp', pourHeight: 'ph', flowRate: 'fr', pressStrength: 'ps', note: 'no',
}
const BEAN_K: Record<string, string> = { name: 'n', roaster: 'r', origin: 'o', process: 'p', roastLevel: 'rl', roastDate: 'rd', notes: 'nt' }
const GEAR_K: Record<string, string> = { name: 'n', type: 't', brand: 'b', notes: 'nt' }
const GRINDER_K: Record<string, string> = { name: 'n', type: 't', burr: 'b', micronsPerClick: 'mpc', zeroOffsetClicks: 'z', maxClicks: 'mc', source: 's', estimated: 'e' }
const WATER_K: Record<string, string> = { name: 'n', supplier: 's', tds: 'td', gh: 'gh', kh: 'kh', notes: 'nt' }

const invert = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]))
const remap = (o: Record<string, unknown>, m: Record<string, string>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [m[k] ?? k, v]))

/** Pack a payload into its short-key wire form. */
function pack(p: SharePayload): Record<string, unknown> {
  const recipe = remap(p.recipe as Record<string, unknown>, RECIPE_K)
  if (Array.isArray(p.recipe.steps)) recipe.s = p.recipe.steps.map((st) => remap(st as unknown as Record<string, unknown>, STEP_K))
  const out: Record<string, unknown> = { v: p.v, r: recipe }
  if (p.bean) out.b = remap(p.bean, BEAN_K)
  if (p.gear) out.g = remap(p.gear, GEAR_K)
  if (p.grinder) out.gr = remap(p.grinder, GRINDER_K)
  if (p.water) out.w = remap(p.water, WATER_K)
  return out
}

/** Unpack the short-key wire form back into a SharePayload. */
function unpack(o: Record<string, any>): SharePayload {
  const recipe = remap(o.r ?? {}, invert(RECIPE_K)) as Record<string, unknown>
  if (Array.isArray(o.r?.s)) recipe.steps = o.r.s.map((st: Record<string, unknown>) => remap(st, invert(STEP_K)))
  return {
    v: o.v,
    recipe: recipe as SharedRecipe,
    bean: o.b && (remap(o.b, invert(BEAN_K)) as SharedBean),
    gear: o.g && (remap(o.g, invert(GEAR_K)) as SharedGear),
    grinder: o.gr && (remap(o.gr, invert(GRINDER_K)) as SharedGrinder),
    water: o.w && (remap(o.w, invert(WATER_K)) as SharedWater),
  }
}

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

  // Drop step ids — they're device-local UUIDs that bloat the payload and are
  // regenerated on import.
  const recipeOut = clean(recipeFields) as Record<string, unknown>
  if (Array.isArray(recipeOut.steps)) {
    recipeOut.steps = recipeOut.steps.map((s) => {
      const { id: _sid, ...rest } = s as Record<string, unknown>
      return clean(rest)
    })
  }

  return clean({
    v: VERSION,
    recipe: recipeOut as unknown as SharedRecipe,
    bean: bean && clean({ name: bean.name, roaster: bean.roaster, origin: bean.origin, process: bean.process, roastLevel: bean.roastLevel, roastDate: bean.roastDate, notes: bean.notes }),
    gear: gear && clean({ name: gear.name, type: gear.type, brand: gear.brand, notes: gear.notes }),
    grinder: grinder && clean({ name: grinder.name, type: grinder.type, burr: grinder.burr, micronsPerClick: grinder.micronsPerClick, zeroOffsetClicks: grinder.zeroOffsetClicks, maxClicks: grinder.maxClicks, source: grinder.source, estimated: grinder.estimated }),
    water: water && clean({ name: water.name, supplier: water.supplier, tds: water.tds, gh: water.gh, kh: water.kh, notes: water.notes }),
  })
}

export function encodePayload(p: SharePayload): string {
  return compressToEncodedURIComponent(JSON.stringify(pack(p)))
}

export function decodePayload(code: string): SharePayload | null {
  try {
    const json = decompressFromEncodedURIComponent(code)
    if (!json) return null
    const p = unpack(JSON.parse(json))
    if (!p?.recipe || !p.recipe.method) return null
    return p
  } catch {
    return null
  }
}

/** Build the full importable URL for a payload (self-contained fragment link). */
export function shareUrl(code: string): string {
  return `${location.origin}/import#${code}`
}

/** Build a short importable URL from a backend-issued id. */
export function shortShareUrl(id: string): string {
  return `${location.origin}/import?s=${id}`
}

export interface ShortLink {
  url: string
  expiresInDays: number
}

/**
 * Stash an encoded payload in the backend (Vercel KV) and return a short link.
 * Returns null if the share service isn't available so callers can fall back to
 * a self-contained fragment link.
 */
export async function createShortLink(code: string): Promise<ShortLink | null> {
  try {
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: code }),
    })
    if (!res.ok) return null
    const { id, expiresInDays } = (await res.json()) as { id?: string; expiresInDays?: number }
    if (!id) return null
    return { url: shortShareUrl(id), expiresInDays: expiresInDays ?? 30 }
  } catch {
    return null
  }
}

/** Resolve a short-link id back to its encoded payload string. */
export async function fetchSharedCode(id: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/share?id=${encodeURIComponent(id)}`)
    if (!res.ok) return null
    const { data } = (await res.json()) as { data?: string }
    return data ?? null
  } catch {
    return null
  }
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

  // Regenerate the step ids that were stripped for sharing.
  const steps = p.recipe.steps?.map((s) => ({ ...s, id: uid() }))

  return saveRecipe({
    ...p.recipe,
    title: p.recipe.title || '',
    method: p.recipe.method,
    steps,
    beanId,
    gearId,
    grinderId,
    waterId,
  })
}
