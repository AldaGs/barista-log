import { useEffect, useRef } from 'react'
import { useSettings } from '@/store/settings'

let audioCtx: AudioContext | null = null

/**
 * Short beep via WebAudio + a haptic buzz, as a step cue. Best-effort.
 * `sharp` swaps the soft sine for a brighter square tone — used for the
 * final-seconds countdown so it's audibly distinct from the pace ticks.
 */
export function cue(strong = false, sharp = false) {
  const { cuesEnabled, cueVolume } = useSettings.getState()
  if (!cuesEnabled) return
  // exponentialRampToValueAtTime can't target 0, so keep a tiny floor.
  const peak = Math.max(0.0001, cueVolume)
  try {
    audioCtx ??= new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = audioCtx
    if (ctx.state === 'suspended') void ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = sharp ? 'square' : 'sine'
    osc.frequency.value = sharp ? 1320 : strong ? 880 : 660
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.26)
  } catch {
    /* audio not available */
  }
  navigator.vibrate?.(sharp ? [40, 30, 40] : strong ? [80, 40, 80] : 60)
}

/**
 * Keep the screen awake while `active` is true (Screen Wake Lock API).
 * Re-acquires after the tab becomes visible again. Best-effort: silently
 * no-ops where unsupported.
 */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    let cancelled = false
    const request = async () => {
      try {
        if (active && 'wakeLock' in navigator && document.visibilityState === 'visible') {
          lockRef.current = await navigator.wakeLock.request('screen')
        }
      } catch {
        /* denied or unsupported */
      }
    }
    const release = () => {
      lockRef.current?.release().catch(() => {})
      lockRef.current = null
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && active && !cancelled) void request()
    }

    if (active) void request()
    else release()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      release()
    }
  }, [active])
}
