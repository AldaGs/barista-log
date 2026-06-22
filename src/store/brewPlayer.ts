import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * The single in-progress guided brew. Persisted so an accidental navigation
 * (or even a reload / crash) never loses a running brew — the timer is
 * wall-clock based, so elapsed keeps advancing while the page is unmounted.
 * The brew stays "open" until the user explicitly restarts, logs, or closes it.
 */
interface BrewPlayerState {
  /** recipe being brewed, or null when there's no active brew */
  recipeId: string | null
  running: boolean
  /** epoch ms when the current running segment began; null while paused */
  startedAt: number | null
  /** elapsed seconds accumulated before the current running segment */
  baseSec: number
  /** checkpoint times the brewer marked, seconds from start */
  laps: number[]

  /** Open a fresh, idle brew for a recipe (0:00, not running, no marks). */
  begin: (recipeId: string) => void
  /** Begin counting from the current elapsed. */
  startRunning: () => void
  /** Freeze the clock, banking elapsed into baseSec. */
  pause: () => void
  /** Zero the clock but keep the recipe loaded (restart this brew). */
  restart: () => void
  /** Tear the brew down entirely (explicit close / after logging). */
  close: () => void
  addLap: (elapsed: number) => void
}

/** Wall-clock elapsed whole seconds for the current player state. */
export function elapsedSec(s: Pick<BrewPlayerState, 'running' | 'startedAt' | 'baseSec'>): number {
  if (s.running && s.startedAt != null) {
    return s.baseSec + Math.max(0, Math.floor((Date.now() - s.startedAt) / 1000))
  }
  return s.baseSec
}

export const useBrewPlayer = create<BrewPlayerState>()(
  persist(
    (set, get) => ({
      recipeId: null,
      running: false,
      startedAt: null,
      baseSec: 0,
      laps: [],

      begin: (recipeId) =>
        set({ recipeId, running: false, startedAt: null, baseSec: 0, laps: [] }),
      startRunning: () => {
        if (get().running) return
        set({ running: true, startedAt: Date.now() })
      },
      pause: () => {
        const s = get()
        if (!s.running) return
        set({ running: false, startedAt: null, baseSec: elapsedSec(s) })
      },
      restart: () => set({ running: false, startedAt: null, baseSec: 0, laps: [] }),
      close: () => set({ recipeId: null, running: false, startedAt: null, baseSec: 0, laps: [] }),
      addLap: (elapsed) => set((s) => ({ laps: [...s.laps, elapsed] })),
    }),
    { name: 'barista-brew-player' },
  ),
)
