import type { BrewMethod } from '@/db/types'
import { AXIS, IDEAL, type BrewPoint } from '@/lib/brewModel'

interface MeasuredPoint {
  point: BrewPoint
  /** 0..1 — older sessions render fainter */
  weight?: number
}

/**
 * Brew control chart: extraction (x) vs strength/TDS (y), with the ideal target
 * window highlighted. Plots an estimated point and any measured (refractometer)
 * points. Heuristic — see lib/brewModel.
 */
export function BrewChart({
  method,
  estimate,
  measured = [],
}: {
  method: BrewMethod
  estimate?: BrewPoint | null
  measured?: MeasuredPoint[]
}) {
  const W = 340
  const H = 260
  const m = { l: 40, r: 14, t: 14, b: 30 }
  const pw = W - m.l - m.r
  const ph = H - m.t - m.b

  const ax = AXIS[method]
  const ideal = IDEAL[method]

  const x = (ext: number) =>
    m.l + ((ext - ax.ext[0]) / (ax.ext[1] - ax.ext[0])) * pw
  const y = (tds: number) =>
    m.t + (1 - (tds - ax.tds[0]) / (ax.tds[1] - ax.tds[0])) * ph

  const idealX = x(ideal.ext[0])
  const idealW = x(ideal.ext[1]) - x(ideal.ext[0])
  const idealY = y(ideal.tds[1])
  const idealH = y(ideal.tds[0]) - y(ideal.tds[1])

  const fmtTds = (v: number) => (method === 'espresso' ? v.toFixed(1) : v.toFixed(2))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Brew control chart">
      {/* plot background */}
      <rect x={m.l} y={m.t} width={pw} height={ph} rx="6" fill="rgb(var(--surface-2))" />

      {/* ideal target window */}
      <rect
        x={idealX}
        y={idealY}
        width={idealW}
        height={idealH}
        fill="rgb(var(--brand) / 0.15)"
        stroke="rgb(var(--brand) / 0.5)"
        strokeDasharray="4 3"
        rx="3"
      />
      <text x={idealX + idealW / 2} y={idealY + idealH / 2 + 3} textAnchor="middle"
        fontSize="9" fill="rgb(var(--brand))" opacity="0.8">ideal</text>

      {/* quadrant hints */}
      <text x={m.l + 4} y={m.t + ph - 4} fontSize="8" fill="rgb(var(--muted))">under · sour</text>
      <text x={m.l + pw - 4} y={m.t + ph - 4} fontSize="8" fill="rgb(var(--muted))" textAnchor="end">over · bitter</text>
      <text x={m.l + pw - 4} y={m.t + 10} fontSize="8" fill="rgb(var(--muted))" textAnchor="end">strong</text>
      <text x={m.l + 4} y={m.t + 10} fontSize="8" fill="rgb(var(--muted))">weak</text>

      {/* axes labels */}
      <text x={m.l + pw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))">
        Extraction %
      </text>
      <text
        x={12}
        y={m.t + ph / 2}
        textAnchor="middle"
        fontSize="10"
        fill="rgb(var(--muted))"
        transform={`rotate(-90 12 ${m.t + ph / 2})`}
      >
        TDS %
      </text>

      {/* axis ticks */}
      {[ax.ext[0], (ax.ext[0] + ax.ext[1]) / 2, ax.ext[1]].map((v) => (
        <text key={`xt${v}`} x={x(v)} y={m.t + ph + 12} textAnchor="middle" fontSize="8" fill="rgb(var(--muted))">
          {v}
        </text>
      ))}
      {[ax.tds[0], (ax.tds[0] + ax.tds[1]) / 2, ax.tds[1]].map((v) => (
        <text key={`yt${v}`} x={m.l - 4} y={y(v) + 3} textAnchor="end" fontSize="8" fill="rgb(var(--muted))">
          {fmtTds(v)}
        </text>
      ))}

      {/* measured points (refractometer) */}
      {measured.map((mp, i) => (
        <circle
          key={i}
          cx={x(clampAxis(mp.point.extraction, ax.ext))}
          cy={y(clampAxis(mp.point.tds, ax.tds))}
          r="5"
          fill="rgb(var(--accent))"
          opacity={0.45 + 0.55 * (mp.weight ?? 1)}
        />
      ))}

      {/* estimated point (hollow ring) */}
      {estimate && (
        <circle
          cx={x(clampAxis(estimate.extraction, ax.ext))}
          cy={y(clampAxis(estimate.tds, ax.tds))}
          r="6"
          fill="rgb(var(--surface))"
          stroke="rgb(var(--brand))"
          strokeWidth="2.5"
        />
      )}
    </svg>
  )
}

function clampAxis(v: number, [lo, hi]: readonly [number, number]) {
  return Math.min(hi, Math.max(lo, v))
}
