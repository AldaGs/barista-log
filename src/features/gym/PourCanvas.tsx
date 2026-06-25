import { useMemo } from 'react'
import type { PourPattern } from '@/db/types'
import { patternPoint, patternGuidePath } from '@/lib/pourPattern'

const SIZE = 220
const C = SIZE / 2
const BED = 82 // bed radius
const RING = 96 // water-progress ring radius

/**
 * Top-down view of the brewer for a drill. Shows the pattern's guide trace, an
 * animated pour dot following it while pouring (a calm pulse while resting),
 * and a ring around the rim that fills with the cumulative water fraction.
 */
export function PourCanvas({
  pattern,
  pouring,
  elapsed,
  waterFrac,
}: {
  pattern: PourPattern | undefined
  pouring: boolean
  /** continuous drill elapsed seconds — drives the dot motion */
  elapsed: number
  /** 0..1 cumulative water poured, for the rim progress ring */
  waterFrac: number
}) {
  const guide = useMemo(() => patternGuidePath(pattern, BED, C, C), [pattern])
  const dot = patternPoint(pattern, elapsed)
  const dx = C + dot.x * BED
  const dy = C + dot.y * BED

  const circ = 2 * Math.PI * RING
  const frac = Math.max(0, Math.min(1, waterFrac))

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[260px]" role="img">
      {/* Water-progress ring */}
      <circle cx={C} cy={C} r={RING} fill="none" stroke="currentColor" strokeWidth={4} className="text-border" />
      <circle
        cx={C}
        cy={C}
        r={RING}
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
        className="text-brand transition-[stroke-dashoffset] duration-200"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - frac)}
        transform={`rotate(-90 ${C} ${C})`}
      />

      {/* Brewer bed */}
      <circle cx={C} cy={C} r={BED} className="fill-surface-2" />
      {/* Growing fill — the bed "floods" from the centre as the pour progresses */}
      <circle
        cx={C}
        cy={C}
        r={BED * frac}
        className="fill-brand/20 transition-[r] duration-200"
      />
      <circle cx={C} cy={C} r={BED} fill="none" stroke="currentColor" strokeWidth={2} className="text-border" />

      {/* Pattern guide trace */}
      <path d={guide} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="3 4" className="text-muted/50" />

      {/* Pour dot / rest pulse */}
      {pouring ? (
        <>
          <circle cx={dx} cy={dy} r={11} className="fill-brand/25">
            <animate attributeName="r" values="9;14;9" dur="1s" repeatCount="indefinite" />
          </circle>
          <circle cx={dx} cy={dy} r={6} className="fill-brand" />
        </>
      ) : (
        <circle cx={C} cy={C} r={7} className="fill-muted">
          <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  )
}
