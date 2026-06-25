import { useMemo } from 'react'
import type { PressureStage } from '@/db/types'

/**
 * Pressure-vs-time curve for an espresso profile. Each stage's `bar` is the
 * pressure reached at the *end* of its window, so the line ramps from the
 * previous level (starting at 0) — a "ramp" stage slopes up, a "hold" stays
 * flat, a "decline" slopes down. Styled with the app's CSS color vars, like
 * BrewChart. Pass `elapsed` (s) to draw a moving playhead during a live shot.
 */
export function PressureCurve({
  stages,
  elapsed,
  className,
}: {
  stages: PressureStage[]
  /** live shot position in seconds — draws a playhead + dot when provided */
  elapsed?: number
  className?: string
}) {
  const W = 340
  const H = 180
  const m = { l: 30, r: 12, t: 12, b: 24 }
  const pw = W - m.l - m.r
  const ph = H - m.t - m.b

  const { pts, total, maxBar } = useMemo(() => {
    const valid = stages.filter((s) => s.sec > 0)
    const total = valid.reduce((sum, s) => sum + s.sec, 0)
    const maxBar = Math.max(10, ...valid.map((s) => s.bar)) // headroom to ≥10 bar
    const pts: { t: number; bar: number }[] = [{ t: 0, bar: 0 }]
    let acc = 0
    for (const s of valid) {
      acc += s.sec
      pts.push({ t: acc, bar: s.bar })
    }
    return { pts, total, maxBar }
  }, [stages])

  if (total <= 0) return null

  const x = (t: number) => m.l + (t / total) * pw
  const y = (bar: number) => m.t + (1 - bar / maxBar) * ph

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t)} ${y(p.bar)}`).join(' ')
  const area = `${line} L ${x(total)} ${y(0)} L ${x(0)} ${y(0)} Z`

  // Interpolate the curve's bar at `elapsed` for the playhead dot.
  const e = elapsed == null ? null : Math.max(0, Math.min(total, elapsed))
  let eBar = 0
  if (e != null) {
    for (let i = 1; i < pts.length; i++) {
      if (e <= pts[i].t) {
        const a = pts[i - 1]
        const b = pts[i]
        const f = b.t === a.t ? 1 : (e - a.t) / (b.t - a.t)
        eBar = a.bar + (b.bar - a.bar) * f
        break
      }
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className ?? 'w-full'} role="img" aria-label="Pressure profile">
      <rect x={m.l} y={m.t} width={pw} height={ph} rx="6" fill="rgb(var(--surface-2))" />

      {/* bar gridlines at 3 / 6 / 9 */}
      {[3, 6, 9].filter((b) => b < maxBar).map((b) => (
        <g key={b}>
          <line x1={m.l} y1={y(b)} x2={m.l + pw} y2={y(b)} stroke="rgb(var(--muted) / 0.2)" strokeDasharray="2 3" />
          <text x={m.l - 4} y={y(b) + 3} textAnchor="end" fontSize="8" fill="rgb(var(--muted))">{b}</text>
        </g>
      ))}

      <path d={area} fill="rgb(var(--brand) / 0.15)" />
      <path d={line} fill="none" stroke="rgb(var(--brand))" strokeWidth="2.5" strokeLinejoin="round" />

      {/* playhead */}
      {e != null && (
        <>
          <line x1={x(e)} y1={m.t} x2={x(e)} y2={m.t + ph} stroke="rgb(var(--accent))" strokeWidth="1.5" />
          <circle cx={x(e)} cy={y(eBar)} r="4" fill="rgb(var(--accent))" />
        </>
      )}

      {/* axes labels */}
      <text x={m.l + pw / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="rgb(var(--muted))">s</text>
      <text x={m.l + pw} y={m.t + ph + 12} textAnchor="end" fontSize="8" fill="rgb(var(--muted))">{Math.round(total)}</text>
      <text x={10} y={m.t + ph / 2} textAnchor="middle" fontSize="9" fill="rgb(var(--muted))" transform={`rotate(-90 10 ${m.t + ph / 2})`}>bar</text>
    </svg>
  )
}
