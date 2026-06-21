import { useEffect, useRef } from 'react'

let audioCtx: AudioContext | null = null

/** Short beep via WebAudio + a haptic buzz, as a step cue. Best-effort. */
export function cue(strong = false) {
  try {
    audioCtx ??= new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = audioCtx
    if (ctx.state === 'suspended') void ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = strong ? 880 : 660
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.26)
  } catch {
    /* audio not available */
  }
  navigator.vibrate?.(strong ? [80, 40, 80] : 60)
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
