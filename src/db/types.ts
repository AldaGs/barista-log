export type BrewMethod = 'espresso' | 'brew'
export type GrinderType = 'hand' | 'electric'
export type BurrType = 'conical' | 'flat'

/** Fields shared by every cloud-syncable record. */
export interface SyncMeta {
  /** true when changed locally and not yet pushed to the cloud */
  dirty: number // 0 | 1 (indexable boolean for Dexie)
  syncedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface Bean extends SyncMeta {
  id: string
  name: string
  roaster?: string
  origin?: string
  process?: string
  roastLevel?: 'light' | 'medium-light' | 'medium' | 'medium-dark' | 'dark'
  roastDate?: string // ISO date
  notes?: string
}

export interface WaterProfile extends SyncMeta {
  id: string
  name: string
  supplier?: string // e.g. "Third Wave Water", "Tap - Mexico City"
  tds?: number // ppm
  gh?: number // general hardness
  kh?: number // carbonate hardness / alkalinity
  notes?: string
}

export interface Grinder extends SyncMeta {
  id: string
  name: string
  type: GrinderType
  burr: BurrType
  /** microns of size change per click/step — the pivot for conversions */
  micronsPerClick: number
  /** optional: clicks from zero-point to the finest usable setting */
  zeroOffsetClicks?: number
  maxClicks?: number
  source?: string
  seeded?: number // 1 if shipped with the app
  /** 1 = µm/click is a rough estimate (e.g. stepless grinder) — flag in UI */
  estimated?: number
}

export interface FlavorScores {
  acidity?: number // 0-5
  body?: number
  sweetness?: number
  bitterness?: number
}

export interface Recipe extends SyncMeta {
  id: string
  title: string
  method: BrewMethod
  beanId?: string
  waterId?: string
  grinderId?: string
  /** raw grinder clicks/setting used */
  grindClicks?: number
  grindLabel?: string // free text fallback ("medium-fine")

  // dose
  doseIn?: number // g
  yieldOut?: number // g (espresso) or water g (brew)
  ratio?: number // computed yield/dose
  waterTemp?: number // °C stored canonically

  // espresso-specific
  shotTimeSec?: number
  pressureBar?: number
  preInfusionSec?: number

  // brew-specific
  brewer?: string // V60, Aeropress, Chemex...
  totalTimeSec?: number
  bloomSec?: number
  pours?: number

  notes?: string
}

export interface BrewSession extends SyncMeta {
  id: string
  recipeId?: string
  beanId?: string
  waterId?: string
  grinderId?: string
  date: number // when brewed
  method: BrewMethod
  /** snapshot of the parameters used that day */
  params: Partial<Recipe>
  rating?: number // 0-5
  flavors?: FlavorScores
  flavorTags?: string[]
  notes?: string
  photo?: Blob
}

export interface FlavorTag {
  id: string
  label: string
}
