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
  /** size of the bag, g (the starting amount) */
  bagSize?: number
  /** grams left in the bag; auto-decremented as brews are logged */
  gramsRemaining?: number
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

export type BrewStepType = 'bloom' | 'pour' | 'agitation' | 'wait' | 'drawdown' | 'press' | 'other'
export type AgitationIntensity = 'light' | 'medium' | 'strong'
export type AgitationMethod = 'swirl' | 'stir' | 'tap'
export type PourPattern = 'circular' | 'elliptical' | 'direct' | 'edge' | 'concentric'
export type PourHeight = 'low' | 'high'
export type FlowRate = 'slow' | 'medium' | 'fast'
export type PressStrength = 'low' | 'medium' | 'hard'

export interface BrewStep {
  id: string
  type: BrewStepType
  /** grams of water added — for bloom / pour */
  water?: number
  /** cumulative target time from start, in seconds */
  atTimeSec?: number
  /** for agitation steps */
  intensity?: AgitationIntensity
  method?: AgitationMethod
  /** for bloom / pour steps — how the water is poured */
  pourPattern?: PourPattern
  pourHeight?: PourHeight
  /** for bloom / pour steps — how fast the water is poured */
  flowRate?: FlowRate
  /** for press steps (Aeropress / French press) — plunge strength */
  pressStrength?: PressStrength
  note?: string
}

export type GearType = 'machine' | 'brewer'

export interface Gear extends SyncMeta {
  id: string
  name: string
  type: GearType
  brand?: string
  notes?: string
  seeded?: number
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
  /** id of the recipe this was forked from, if any — tracks lineage */
  forkedFromId?: string
  beanId?: string
  waterId?: string
  grinderId?: string
  /** espresso machine (method=espresso) or brewer (method=brew), from the gear library */
  gearId?: string
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
  /** ordered pour/agitation schedule for brew recipes */
  steps?: BrewStep[]

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
  /** measured total dissolved solids, % (from a refractometer) */
  tds?: number
  /** measured beverage weight in the cup, g (improves extraction calc) */
  beverageWeight?: number
  /** actual total brew time as run in the guided player, seconds */
  actualTotalSec?: number
  /** actual checkpoint times the brewer marked during the pour, seconds from start */
  actualLaps?: number[]
  notes?: string
  photo?: Blob
}

export interface FlavorTag {
  id: string
  label: string
}

/**
 * The single user profile record. Stored under the fixed id `'me'` so it's
 * one-per-account and rides the generic cloud sync like any other collection.
 */
export interface Profile extends SyncMeta {
  /** fixed singleton id (PROFILE_ID) — a constant UUID so it's valid for cloud sync */
  id: string
  // identity
  displayName?: string
  /** id of the chosen lucide avatar icon (see AVATAR_ICONS); JSON/sync-friendly */
  avatarIcon?: string
  /** optional profile picture; local-only Blob (stripped from cloud sync & JSON backup, like session photos) */
  photo?: Blob
  cafe?: string // home café / location
  bio?: string
  // brewing defaults — all optional, used to prefill a brand-new recipe
  defaultMethod?: BrewMethod
  defaultBeanId?: string
  defaultGrinderId?: string
  defaultGearId?: string
  defaultRatio?: number
  defaultDoseIn?: number // g
  defaultWaterTemp?: number // °C stored canonically, like Recipe.waterTemp
}
