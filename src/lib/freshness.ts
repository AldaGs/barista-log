import type { Bean } from '@/db/types'

export type FreshnessStatus = 'unknown' | 'resting' | 'peak' | 'fading' | 'stale'

export interface Freshness {
  status: FreshnessStatus
  /** whole days since the roast date, or null if no roast date */
  ageDays: number | null
  /** days the coffee should rest before it stops being "too fresh" */
  restDays: number
}

const DAY = 86_400_000

/**
 * Degassing rest period before a coffee is ready to drink. Darker roasts release
 * CO₂ faster, so they need less rest; light roasts need more.
 */
function restDaysFor(roastLevel?: Bean['roastLevel']): number {
  switch (roastLevel) {
    case 'dark':
    case 'medium-dark':
      return 3
    case 'medium':
      return 5
    case 'medium-light':
      return 7
    case 'light':
      return 10
    default:
      return 5
  }
}

/** Roughly when flavor starts fading / goes stale, in days off roast. */
const FADING_AFTER = 30
const STALE_AFTER = 60

/** Classify a bean's freshness from its roast date and roast level. */
export function freshness(bean: Pick<Bean, 'roastDate' | 'roastLevel'>): Freshness {
  const restDays = restDaysFor(bean.roastLevel)
  if (!bean.roastDate) return { status: 'unknown', ageDays: null, restDays }

  const roastedAt = new Date(bean.roastDate).getTime()
  if (Number.isNaN(roastedAt)) return { status: 'unknown', ageDays: null, restDays }

  const ageDays = Math.floor((Date.now() - roastedAt) / DAY)
  let status: FreshnessStatus
  if (ageDays < 0) status = 'resting' // roast date in the future — treat as too fresh
  else if (ageDays < restDays) status = 'resting'
  else if (ageDays <= FADING_AFTER) status = 'peak'
  else if (ageDays <= STALE_AFTER) status = 'fading'
  else status = 'stale'

  return { status, ageDays, restDays }
}

export interface Stock {
  /** grams left, or null if the bag isn't tracked */
  grams: number | null
  isLow: boolean
  isEmpty: boolean
}

/** ~25 g (about two doses) left counts as low. */
const LOW_GRAMS = 25

export function stock(bean: Pick<Bean, 'gramsRemaining'>): Stock {
  const grams = bean.gramsRemaining ?? null
  if (grams == null) return { grams: null, isLow: false, isEmpty: false }
  return { grams, isLow: grams > 0 && grams <= LOW_GRAMS, isEmpty: grams <= 0 }
}
