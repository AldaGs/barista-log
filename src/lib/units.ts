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
