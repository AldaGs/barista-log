import type { BrewStep } from '@/db/types'

/**
 * How step times are written and shown. Recipes always *store* each step's
 * `atTimeSec` as the moment it should be finished (the brew clock time it ends
 * at); this preference only changes how that is entered and displayed, so a
 * shared recipe automatically reads in the receiver's own style.
 *  - end:      the brew clock time the step finishes at (stored form)
 *  - start:    the brew clock time the step begins at (= previous step's end)
 *  - duration: how long the step lasts (= its end − previous step's end)
 */
export type StepTimeMode = 'end' | 'start' | 'duration'

const endAt = (steps: BrewStep[], i: number) => (i < 0 ? 0 : steps[i]?.atTimeSec ?? 0)

/** The value step `i` shows in `mode`, derived from the stored end times. */
export function stepTimeValue(steps: BrewStep[], i: number, mode: StepTimeMode): number | undefined {
  if (mode === 'start') return i === 0 ? 0 : steps[i - 1]?.atTimeSec
  const end = steps[i]?.atTimeSec
  if (mode === 'end' || end == null) return end
  return Math.max(0, end - endAt(steps, i - 1))
}

/**
 * Apply a value entered for step `i` in `mode`, returning the new steps with
 * canonical end times.
 *  - start edits the previous step's end (step 0 always starts at 0:00).
 *  - duration sets this step's end and shifts every later step by the same
 *    amount, so their own durations are kept.
 */
export function setStepTime(
  steps: BrewStep[],
  i: number,
  mode: StepTimeMode,
  value: number | undefined,
): BrewStep[] {
  const next = steps.map((s) => ({ ...s }))
  if (mode === 'end') {
    next[i].atTimeSec = value
  } else if (mode === 'start') {
    if (i > 0) next[i - 1].atTimeSec = value
  } else {
    const oldEnd = next[i].atTimeSec
    const newEnd = value == null ? undefined : endAt(next, i - 1) + value
    next[i].atTimeSec = newEnd
    const delta = (newEnd ?? 0) - (oldEnd ?? 0)
    if (oldEnd != null && newEnd != null && delta !== 0)
      for (let j = i + 1; j < next.length; j++)
        if (next[j].atTimeSec != null) next[j].atTimeSec = next[j].atTimeSec! + delta
  }
  return next
}
