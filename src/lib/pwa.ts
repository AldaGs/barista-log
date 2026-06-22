/**
 * Install-prompt plumbing for the PWA.
 *
 * Chromium fires `beforeinstallprompt` once, early — often before React mounts —
 * so we capture and stash the event at module load. iOS/Safari never fires it
 * and has no programmatic install, so there we fall back to "Add to Home Screen"
 * instructions. Installing the app is also what makes storage durable (see
 * lib/storage), which is the real reason we nudge.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // stop the mini-infobar; we'll prompt on our own button
    deferred = e as BeforeInstallPromptEvent
    listeners.forEach((fn) => fn())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((fn) => fn())
  })
}

/** Subscribe to install-availability changes. Returns an unsubscribe fn. */
export function onInstallChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** True when we hold a deferred prompt we can fire. */
export function canInstall(): boolean {
  return deferred !== null
}

/** Already running as an installed app (standalone display mode). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari exposes this non-standard flag instead
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/** iOS Safari — no programmatic install, needs manual Add to Home Screen. */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/** Fire the native install prompt. Returns true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  listeners.forEach((fn) => fn())
  return outcome === 'accepted'
}
