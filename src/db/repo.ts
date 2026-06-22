import { db, now, uid } from './dexie'
import type {
  Bean,
  BrewSession,
  Gear,
  Grinder,
  Profile,
  Recipe,
  SyncMeta,
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

// ---- Recipe naming -------------------------------------------------------
const VERSION_RE = /\s+v(\d+(?:\.\d+)*)$/i
const LEGACY_TAG_RE = /\s*\((?:fork|copy)\)\s*$/i

/**
 * Split a recipe title into its family base name and version path.
 * Version "1" means the original. Legacy "(fork)"/"(copy)" suffixes are stripped.
 * e.g. "Origami v3.1" → { base: "Origami", version: "3.1" }
 */
export function parseFamily(title: string | undefined): { base: string; version: string } {
  let base = (title ?? '').trim()
  let version = '1'
  const m = base.match(VERSION_RE)
  if (m) {
    version = m[1]
    base = base.slice(0, m.index).trim()
  }
  while (LEGACY_TAG_RE.test(base)) base = base.replace(LEGACY_TAG_RE, '').trim()
  return { base, version }
}

/**
 * Title for a new fork, cascading off its parent's lineage:
 * forks of the original get v2, v3…; forks of vN get vN.1, vN.2…
 * so the title mirrors the position in the fork tree and never stacks.
 */
export async function nextForkTitle(parent: Recipe): Promise<string> {
  const { base, version } = parseFamily(parent.title)
  const siblings = await db.recipes.where('forkedFromId').equals(parent.id).count()
  const next = version === '1' ? `${siblings + 2}` : `${version}.${siblings + 1}`
  return base ? `${base} v${next}` : `v${next}`
}

/** Title for an unlinked copy — non-stacking, drops any inherited version/fork tag. */
export function copyTitle(source: Recipe): string {
  const { base } = parseFamily(source.title)
  return base ? `${base} (copy)` : '(copy)'
}

/** Reduce a trailing run of repeated "(fork)"/"(copy)" tags to just the last one. */
function collapseLegacyTags(title: string): string {
  const m = title.match(/^(.*?)((?:\s*\((?:fork|copy)\)){2,})\s*$/i)
  if (!m) return title
  const tags = m[2].match(/\((?:fork|copy)\)/gi)!
  return `${m[1].trim()} ${tags[tags.length - 1]}`.trim()
}

const FORK_TITLES_MIGRATED = 'slurry-fork-titles-migrated-v1'

/**
 * One-time cleanup of legacy fork/copy titles. Walks each lineage tree and
 * renames every linked fork to the cascade version scheme (v2, v3, v3.1…) so
 * names stop stacking "(fork) (fork)". Standalone recipes only get repeated
 * tags collapsed; their base name is left intact. Idempotent and gated by a
 * per-device flag; renamed rows are marked dirty so the fix syncs.
 */
export async function migrateForkTitles(): Promise<number> {
  if (localStorage.getItem(FORK_TITLES_MIGRATED)) return 0

  const all = await db.recipes.toArray()
  const byId = new Map(all.map((r) => [r.id, r]))
  const children = new Map<string, Recipe[]>()
  for (const r of all) {
    const p = r.forkedFromId
    if (p && byId.has(p) && p !== r.id) {
      const list = children.get(p) ?? []
      list.push(r)
      children.set(p, list)
    }
  }
  for (const list of children.values()) {
    list.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
  }

  const newTitle = new Map<string, string>()

  // Assign cascade versions to every fork, top-down from each tree's root.
  const walk = (node: Recipe, base: string, version: string) => {
    const kids = children.get(node.id) ?? []
    kids.forEach((kid, i) => {
      const v = version === '1' ? `${i + 2}` : `${version}.${i + 1}`
      newTitle.set(kid.id, base ? `${base} v${v}` : `v${v}`)
      walk(kid, base, v)
    })
  }
  const roots = all.filter((r) => !r.forkedFromId || !byId.has(r.forkedFromId))
  for (const root of roots) {
    // Roots keep their name; just collapse any stacked tags they happen to have.
    const collapsed = collapseLegacyTags(root.title ?? '')
    if (collapsed !== (root.title ?? '')) newTitle.set(root.id, collapsed)
    walk(root, parseFamily(root.title).base, '1')
  }

  let changed = 0
  const ts = now()
  for (const r of all) {
    const nt = newTitle.get(r.id)
    if (nt != null && nt !== r.title) {
      await db.recipes.update(r.id, { title: nt, dirty: 1, updatedAt: ts })
      changed++
    }
  }

  localStorage.setItem(FORK_TITLES_MIGRATED, '1')
  if (changed) triggerSync()
  return changed
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
    const rec = { ...ratio, ...freshMeta() } as Recipe
    await db.recipes.add(rec)
    id = rec.id
  }
  triggerSync()
  return id
}

export const latestRecipe = () =>
  db.recipes.orderBy('updatedAt').reverse().first()

export const deleteRecipe = (id: string) => deleteWithTombstone('recipes', id)

/** Pin/unpin a recipe to the top of Home & the browse view. */
export async function toggleFavorite(id: string) {
  const r = await db.recipes.get(id)
  if (!r) return
  await db.recipes.update(id, { favorite: r.favorite ? 0 : 1, dirty: 1, updatedAt: now() })
  triggerSync()
}

// ---- Sessions ------------------------------------------------------------
export async function saveSession(
  data: Omit<BrewSession, keyof NewMeta> & Partial<Pick<BrewSession, 'id'>>,
): Promise<string> {
  let id: string
  if (data.id) {
    await db.sessions.update(data.id, { ...data, dirty: 1, updatedAt: now() })
    id = data.id
  } else {
    const rec = { ...data, ...freshMeta() } as BrewSession
    await db.sessions.add(rec)
    id = rec.id
    await decrementBeanStock(rec.beanId, rec.params?.doseIn)
  }
  triggerSync()
  return id
}

/** Subtract a logged dose from the bean's remaining stock, if it's tracked. */
async function decrementBeanStock(beanId?: string, doseIn?: number) {
  if (!beanId || !doseIn) return
  const bean = await db.beans.get(beanId)
  if (!bean || bean.gramsRemaining == null) return
  const next = Math.max(Math.round((bean.gramsRemaining - doseIn) * 10) / 10, 0)
  await db.beans.update(beanId, { gramsRemaining: next, dirty: 1, updatedAt: now() })
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
    const rec = { ...data, ...freshMeta() } as Bean
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
    const rec = { ...data, ...freshMeta() } as WaterProfile
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
    const rec = { seeded: 0, ...data, ...freshMeta() } as Grinder
    await db.grinders.add(rec)
    id = rec.id
  }
  triggerSync()
  return id
}
export const deleteGrinder = (id: string) => deleteWithTombstone('grinders', id)

// ---- Gear (machines & brewers) ------------------------------------------
export async function saveGear(
  data: Omit<Gear, keyof NewMeta | 'seeded'> & Partial<Pick<Gear, 'id' | 'seeded'>>,
): Promise<string> {
  let id: string
  if (data.id) {
    await db.gear.update(data.id, { ...data, dirty: 1, updatedAt: now() })
    id = data.id
  } else {
    const rec = { seeded: 0, ...data, ...freshMeta() } as Gear
    await db.gear.add(rec)
    id = rec.id
  }
  triggerSync()
  return id
}
export const deleteGear = (id: string) => deleteWithTombstone('gear', id)

// ---- Profile (singleton) -------------------------------------------------
// Fixed id for the one-per-user profile row. Must be a valid UUID because the
// cloud `sync_records.id` column is typed uuid (an arbitrary string like 'me'
// is rejected with a 400 on push).
const PROFILE_ID = '00000000-0000-4000-8000-000000000001'

/** The single profile row, or undefined until the user saves one. */
export const getProfile = () => db.profile.get(PROFILE_ID)

/** Create or update the singleton profile (always id `'me'`). */
export async function saveProfile(
  data: Omit<Profile, keyof SyncMeta | 'id'>,
): Promise<void> {
  const existing = await db.profile.get(PROFILE_ID)
  if (existing) {
    await db.profile.update(PROFILE_ID, { ...data, dirty: 1, updatedAt: now() })
  } else {
    const ts = now()
    await db.profile.add({
      ...data,
      id: PROFILE_ID,
      dirty: 1,
      syncedAt: null,
      createdAt: ts,
      updatedAt: ts,
    })
  }
  triggerSync()
}
