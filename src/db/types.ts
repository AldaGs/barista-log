export type BrewMethod = 'espresso' | 'brew' | 'coldbrew'
/**
 * Dedicated cold-brew styles. Each implies a different prep & timing model:
 * - `immersion` — grounds fully submerged for hours (mason jar, Toddy, Mizudashi)
 * - `slow-drip`  — cold water drips through the bed over hours (Kyoto/Dutch tower)
 * - `flash`      — hot brew dropped straight onto ice ("Japanese iced"); reuses
 *                  the hot `steps[]` schedule + `waterTemp`, just with `iceGrams`
 */
export type ColdBrewStyle = 'immersion' | 'slow-drip' | 'flash'
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

/**
 * Optional hot bloom kicked off *before* the cold fill. Many baristas wet the
 * bed with a small hot pour to jump-start degassing/extraction, then top up
 * with cold water and steep. Distinct from a brew `BrewStep` because it carries
 * its own temperature and is measured against the steep, not the second-clock.
 */
export interface ColdBloom {
  /** g of hot water for the bloom pour */
  water: number
  /** bloom temperature, °C (stored canonically like Recipe.waterTemp) */
  tempC?: number
  /** how long to let the hot bloom sit before the cold fill, seconds */
  sec?: number
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
  /** pinned to the top of Home & browse (1 = favorite) */
  favorite?: number
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
  /** ordered pour/agitation schedule for brew recipes (also `flash` cold brew) */
  steps?: BrewStep[]

  // cold-brew-specific (method = 'coldbrew')
  coldBrewStyle?: ColdBrewStyle
  /** total steep / drip duration, **hours** (fractional ok) — replaces the
   *  seconds-based timer, which is meaningless at a 12–24h scale */
  steepHours?: number
  /** optional hot bloom before the cold fill */
  hotBloom?: ColdBloom
  /** 1 = yields a concentrate meant to be diluted before serving */
  concentrate?: number
  /** parts water/milk per part concentrate when serving (e.g. 3 → 1:3) */
  dilutionRatio?: number
  /** grams of ice — brewed onto (flash) or added to the glass when serving */
  iceGrams?: number

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
  /** actual steep duration for cold brew, hours — measured by the steep timer */
  actualSteepHours?: number
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
