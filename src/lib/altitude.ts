/**
 * Altitude → boiling-point helpers. Water boils cooler as you climb because
 * atmospheric pressure drops, which caps how hot brew water can actually get.
 * Stored canonically in meters above sea level.
 */

/** °C users think in meters, °F users in feet. Stored canonically in meters. */
export const mToFt = (m: number) => Math.round(m * 3.28084)
export const ftToM = (ft: number) => Math.round(ft / 3.28084)

/** Approximate boiling point of water (°C) at a given altitude in meters. */
export function boilingPointC(altitudeM: number): number {
  // Linear approximation, accurate to ~0.3 °C through the brewing-relevant
  // range (0–3000 m): ~−1 °C per 285 m of elevation gain.
  return 100 - Math.max(0, altitudeM) / 285
}

/**
 * Look up ground elevation (meters) for a lat/lon via Open-Meteo's free,
 * key-less elevation API. Throws on network/HTTP failure so callers can fall
 * back to the manually entered value.
 */
export async function fetchElevation(lat: number, lon: number): Promise<number> {
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`elevation lookup failed (${res.status})`)
  const data = (await res.json()) as { elevation?: number[] }
  const m = data.elevation?.[0]
  if (m == null || Number.isNaN(m)) throw new Error('no elevation returned')
  return Math.round(m)
}

/**
 * Detect the device's ground elevation: browser geolocation for lat/lon, then
 * an elevation lookup (the GPS `altitude` field is unreliable / usually null).
 */
export function detectAltitude(): Promise<number> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('geolocation unavailable'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          resolve(await fetchElevation(pos.coords.latitude, pos.coords.longitude))
        } catch (err) {
          reject(err)
        }
      },
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    )
  })
}
