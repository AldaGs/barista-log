export type TempUnit = 'C' | 'F'

export const cToF = (c: number) => Math.round((c * 9) / 5 + 32)
export const fToC = (f: number) => Math.round(((f - 32) * 5) / 9)

/** Stored canonically in °C; format for display in the user's chosen unit. */
export function formatTemp(c: number | undefined, unit: TempUnit): string {
  if (c == null) return '—'
  return unit === 'C' ? `${c}°C` : `${cToF(c)}°F`
}

export function formatSeconds(s: number | undefined): string {
  if (!s && s !== 0) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`
}

/** mm:ss clock for inputs — always shows minutes (e.g. 0:30, 1:10). */
export function toClock(s: number | undefined): string {
  if (s == null) return ''
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

/** Parse "1:10", "70", or "1'10" into seconds. Returns undefined if empty. */
export function parseClock(input: string): number | undefined {
  const v = input.trim().replace(/['"]/g, ':').replace(/:$/, '')
  if (v === '') return undefined
  if (v.includes(':')) {
    const [m, s] = v.split(':')
    return (Number(m) || 0) * 60 + (Number(s) || 0)
  }
  return Number(v) || 0
}
