/**
 * Durable-storage helpers for the PWA.
 *
 * IndexedDB lives in "best-effort" storage by default, which the browser may
 * evict under storage pressure — and iOS Safari wipes it after 7 days of not
 * opening the app. `navigator.storage.persist()` asks the browser to exempt
 * this origin from eviction; it's far more likely to be granted once the PWA is
 * installed to the home screen. None of this leaves the device.
 */

export interface StorageStatus {
  /** browser exposes the StorageManager API */
  supported: boolean
  /** storage is persistent and exempt from automatic eviction */
  persisted: boolean
  /** bytes used by this origin, if the browser reports it */
  usage: number | null
  /** storage quota for this origin, if the browser reports it */
  quota: number | null
}

/**
 * Request persistent storage if we don't already have it. Safe to call on every
 * startup — it no-ops when already persisted or unsupported. Returns the final
 * persisted state.
 */
export async function ensurePersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/** Read the current persistence + quota state for display in Settings. */
export async function getStorageStatus(): Promise<StorageStatus> {
  if (!navigator.storage?.persisted) {
    return { supported: false, persisted: false, usage: null, quota: null }
  }
  const persisted = await navigator.storage.persisted().catch(() => false)
  let usage: number | null = null
  let quota: number | null = null
  if (navigator.storage.estimate) {
    const est = await navigator.storage.estimate().catch(() => null)
    usage = est?.usage ?? null
    quota = est?.quota ?? null
  }
  return { supported: true, persisted, usage, quota }
}

/** Human-readable size (e.g. "3.2 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}
