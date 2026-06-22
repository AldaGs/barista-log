import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * A cold brew that's currently steeping. Unlike the guided brew player, this is
 * a pure wall-clock countdown to a *ready* moment hours away — there's no
 * pause, no second-by-second pour schedule, and it's expected to run while the
 * app is closed (PWA installed to the Home Screen on iOS, where Web
 * Notifications are unavailable, so we surface a persistent steeping pill
 * instead). The user explicitly stops it when they pull the steep to log it.
 *
 * Single-slot for now to mirror the brew player; multiple concurrent jars is a
 * future extension (key the map by recipeId).
 */
interface ColdSteepState {
  /** recipe being steeped, or null when nothing is steeping */
  recipeId: string | null
  /** epoch ms the steep began */
  startedAt: number | null
  /** target steep duration, ms (steepHours × 3.6e6) */
  targetMs: number

  /** Start steeping a recipe for `steepHours` (fractional ok). */
  begin: (recipeId: string, steepHours: number) => void
  /** Stop the steep (after logging, or to discard). */
  stop: () => void
}

export const useColdSteep = create<ColdSteepState>()(
  persist(
    (set) => ({
      recipeId: null,
      startedAt: null,
      targetMs: 0,
      begin: (recipeId, steepHours) =>
        set({ recipeId, startedAt: Date.now(), targetMs: steepHours * 3_600_000 }),
      stop: () => set({ recipeId: null, startedAt: null, targetMs: 0 }),
    }),
    { name: 'barista-cold-steep' },
  ),
)

/** Whole ms elapsed since the steep began (0 if not steeping). */
export function steepElapsedMs(s: Pick<ColdSteepState, 'startedAt'>): number {
  return s.startedAt == null ? 0 : Math.max(0, Date.now() - s.startedAt)
}

/** Fraction 0–1 of the target steep completed. */
export function steepProgress(s: Pick<ColdSteepState, 'startedAt' | 'targetMs'>): number {
  if (s.startedAt == null || s.targetMs <= 0) return 0
  return Math.min(1, steepElapsedMs(s) / s.targetMs)
}

/** Epoch ms the steep is ready, or null if not steeping. */
export function steepReadyAt(s: Pick<ColdSteepState, 'startedAt' | 'targetMs'>): number | null {
  return s.startedAt == null ? null : s.startedAt + s.targetMs
}
