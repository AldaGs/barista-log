import type { Recipe } from '@/db/types'
import { formatTemp, type TempUnit } from '@/lib/units'
import { IDEAL, beverageWeight, estimateBrew } from '@/lib/brewModel'

/**
 * Read-only "opinion engine": turns the numbers a user already entered into
 * plain-language suggestions. Nothing here mutates the recipe — it only
 * surfaces what the heuristic brew model (lib/brewModel) implies, plus a few
 * range checks on ratio, temperature and steep time. Each insight is an i18n
 * key + interpolation vars so the UI stays translatable.
 */
export type InsightTone = 'good' | 'warn' | 'tip'

export interface Insight {
  id: string
  tone: InsightTone
  /** i18n key under `insights.*` */
  key: string
  vars?: Record<string, string | number>
}

/** Typical ratio band (yield/dose) by method/style — directional, not gospel. */
function ratioBand(r: Partial<Recipe>): [number, number] | null {
  if (r.method === 'espresso') return [1.5, 2.5]
  if (r.method === 'brew') return [15, 18]
  if (r.method === 'coldbrew') {
    if (r.coldBrewStyle === 'flash') return [12, 16]
    if (r.concentrate) return [4, 8]
    return [8, 15] // ready-to-drink immersion / slow-drip
  }
  return null
}

/** Typical water/brew-temperature band (°C), or null when it doesn't apply. */
function tempBand(r: Partial<Recipe>): [number, number] | null {
  if (r.method === 'espresso' || r.method === 'brew') return [90, 96]
  if (r.method === 'coldbrew' && r.coldBrewStyle === 'flash') return [85, 96]
  return null // immersion/slow-drip is cold
}

/** Typical steep band (hours) for the cold styles that steep. */
function steepBand(r: Partial<Recipe>): [number, number] | null {
  if (r.method !== 'coldbrew') return null
  if (r.coldBrewStyle === 'slow-drip') return [3, 8]
  if (r.coldBrewStyle === 'flash') return null
  return [12, 24] // immersion
}

export interface InsightOpts {
  micronsPerClick?: number
  tempUnit: TempUnit
}

export function buildInsights(r: Partial<Recipe>, opts: InsightOpts): Insight[] {
  const out: Insight[] = []
  const { micronsPerClick, tempUnit } = opts

  // --- Extraction & strength, straight from the model ---------------------
  const est = estimateBrew(r, micronsPerClick)
  const ideal = r.method ? IDEAL[r.method] : undefined
  if (est && ideal) {
    const ext = Math.round(est.extraction * 10) / 10
    const [exLo, exHi] = ideal.ext
    if (ext < exLo) out.push({ id: 'ex', tone: 'warn', key: 'exLow', vars: { ext, lo: exLo, hi: exHi } })
    else if (ext > exHi) out.push({ id: 'ex', tone: 'warn', key: 'exHigh', vars: { ext, lo: exLo, hi: exHi } })
    else out.push({ id: 'ex', tone: 'good', key: 'exGood', vars: { ext, lo: exLo, hi: exHi } })

    const dp = r.method === 'espresso' ? 1 : 2
    const tds = Number(est.tds.toFixed(dp))
    const [tdsLo, tdsHi] = ideal.tds
    if (tds < tdsLo) out.push({ id: 'tds', tone: 'tip', key: 'tdsLow', vars: { tds, lo: tdsLo, hi: tdsHi } })
    else if (tds > tdsHi) out.push({ id: 'tds', tone: 'tip', key: 'tdsHigh', vars: { tds, lo: tdsLo, hi: tdsHi } })
    else out.push({ id: 'tds', tone: 'good', key: 'tdsGood', vars: { tds, lo: tdsLo, hi: tdsHi } })
  }

  // --- Ratio band ---------------------------------------------------------
  const ratio = r.ratio ?? (r.doseIn && r.yieldOut ? r.yieldOut / r.doseIn : undefined)
  const rb = ratioBand(r)
  if (ratio && rb) {
    const rr = Math.round(ratio * 10) / 10
    if (rr < rb[0]) out.push({ id: 'ratio', tone: 'tip', key: 'ratioTight', vars: { ratio: rr, lo: rb[0], hi: rb[1] } })
    else if (rr > rb[1]) out.push({ id: 'ratio', tone: 'tip', key: 'ratioLoose', vars: { ratio: rr, lo: rb[0], hi: rb[1] } })
  }

  // --- Temperature band ---------------------------------------------------
  const tb = tempBand(r)
  if (r.waterTemp != null && tb) {
    const range = `${formatTemp(tb[0], tempUnit)}–${formatTemp(tb[1], tempUnit)}`
    if (r.waterTemp < tb[0]) out.push({ id: 'temp', tone: 'warn', key: 'tempLow', vars: { temp: formatTemp(r.waterTemp, tempUnit), range } })
    else if (r.waterTemp > tb[1]) out.push({ id: 'temp', tone: 'warn', key: 'tempHigh', vars: { temp: formatTemp(r.waterTemp, tempUnit), range } })
  }

  // --- Steep band ---------------------------------------------------------
  const sb = steepBand(r)
  if (r.steepHours != null && sb) {
    if (r.steepHours < sb[0]) out.push({ id: 'steep', tone: 'warn', key: 'steepShort', vars: { h: r.steepHours, lo: sb[0], hi: sb[1] } })
    else if (r.steepHours > sb[1]) out.push({ id: 'steep', tone: 'warn', key: 'steepLong', vars: { h: r.steepHours, lo: sb[0], hi: sb[1] } })
  }

  // --- Concentrate dilution target ----------------------------------------
  // Suggest a dilution that lands the served cup in the mid-strength band,
  // derived from the brewed concentrate strength vs. a ~1.3% target.
  if (r.method === 'coldbrew' && r.concentrate && r.doseIn) {
    const undiluted = beverageWeight({ ...r, concentrate: 0, dilutionRatio: undefined })
    const est0 = estimateBrew({ ...r, concentrate: 0, dilutionRatio: undefined }, micronsPerClick)
    if (undiluted && est0) {
      const target = 1.3 // % TDS for a balanced ready-to-drink cup
      const suggested = Math.max(0, Math.round((est0.tds / target - 1) * 10) / 10)
      if (suggested > 0) out.push({ id: 'dilution', tone: 'tip', key: 'dilutionTip', vars: { dil: suggested, target } })
    }
  }

  // warnings first, then tips, then confirmations
  const order: InsightTone[] = ['warn', 'tip', 'good']
  return out.sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone))
}
