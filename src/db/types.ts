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
  /** price paid for the bag, in the user's chosen currency — drives cost stats */
  price?: number
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

export type PressureStageLabel = 'preinfusion' | 'ramp' | 'hold' | 'decline' | 'other'

/**
 * One stage of an espresso pressure profile: hold `bar` pressure for `sec`
 * seconds. An ordered list of these describes a profiled shot (e.g. a gentle
 * preinfusion, a ramp to 9 bar, a hold, then a declining tail).
 */
export interface PressureStage {
  id: string
  label?: PressureStageLabel
  /** duration of this stage, seconds */
  sec: number
  /** target pressure during this stage, bar */
  bar: number
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
  /** optional staged pressure profile (preinfusion → ramp → hold → decline);
   *  when present it's the source of truth for the shot timeline & curve, with
   *  the single `pressureBar`/`preInfusionSec` kept as a simple fallback */
  pressureProfile?: PressureStage[]

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
 * A coffee-bag label photo the user wants to keep. The cropped image is a
 * local-only Blob (like session/profile photos), so it is stripped from cloud
 * sync — but, unlike those, it IS carried in the JSON / Google-Drive backup as a
 * base64 data URL so a curated label collection survives a lost device.
 */
export interface Label extends SyncMeta {
  id: string
  /** cropped JPEG, stored locally as a Blob */
  image: Blob
  name?: string
  /** optional link to the bean this bag is */
  beanId?: string
  notes?: string
}

/**
 * A completed pour-practice drill. Logged when a Gym or recipe-practice run
 * finishes, so the app can total up how long the user has trained.
 */
export interface PracticeLog extends SyncMeta {
  id: string
  date: number
  /** drill length actually run, seconds */
  durationSec: number
  /** where it came from: the free Gym, or replaying a recipe's pours */
  kind: 'gym' | 'recipe'
  /** pour pattern drilled (gym), when fixed */
  pattern?: PourPattern
  /** recipe replayed, for kind === 'recipe' */
  recipeId?: string
}

/**
 * A formal SCA-style cupping score for a coffee. Lives attached to a Bean (the
 * thing being evaluated), independent of any brew recipe. Seven attributes are
 * scored 6.00–10.00 in 0.25 steps; uniformity, clean cup and sweetness are the
 * 5-cup attributes stored as a 0–10 value (2 points per clean cup). The total
 * (`score`, out of 100) = sum of all ten attributes − `defects`, cached on save.
 */
export interface Cupping extends SyncMeta {
  id: string
  beanId: string
  date: number
  // 6.00–10.00 quality attributes
  fragrance?: number
  flavor?: number
  aftertaste?: number
  acidity?: number
  body?: number
  balance?: number
  overall?: number
  // 5-cup attributes, stored 0–10 (clean cups × 2)
  uniformity?: number
  cleanCup?: number
  sweetness?: number
  /** points subtracted for taints/faults */
  defects?: number
  /** cached total out of 100 */
  score?: number
  notes?: string
}

/** Common upkeep jobs — drives the icon + interval preset in the UI. */
export type MaintenanceKind =
  | 'descale'
  | 'backflush'
  | 'clean-grinder'
  | 'replace-filter'
  | 'replace-burr'
  | 'clean-brewer'
  | 'other'

/**
 * A recurring maintenance job for a piece of gear (machine, brewer or grinder).
 * `lastDoneAt` + `intervalDays` drive the "due" computation; each completion is
 * also pushed onto `history` so the user keeps a record of what was done when.
 */
export interface MaintenanceTask extends SyncMeta {
  id: string
  kind: MaintenanceKind
  /** free-text label, defaults to the kind's name */
  label: string
  /** optional link to a gear or grinder this job belongs to */
  gearId?: string
  grinderId?: string
  /** recurrence in days — omitted for one-off jobs */
  intervalDays?: number
  /** epoch ms of the most recent completion */
  lastDoneAt?: number
  /** epoch ms of past completions (most recent last) */
  history?: number[]
  notes?: string
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
