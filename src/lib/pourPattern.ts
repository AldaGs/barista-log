import type { PourPattern } from '@/db/types'

const TAU = Math.PI * 2

/**
 * Slows the motion to a human pour cadence (~0.45 rev/s spiral) rather than the
 * raw geometric speed. Scaling time uniformly keeps each pattern's shape.
 */
const PACE = 0.3

/**
 * Where the pour stream should be at continuous progress `t` (seconds), for a
 * given pattern. Returns normalized brewer coordinates x,y ∈ [-1, 1], with
 * (0, 0) the center of the bed. Drives the animated guide dot in the gym.
 */
export function patternPoint(p: PourPattern | undefined, time: number): { x: number; y: number } {
  const t = time * PACE
  switch (p) {
    case 'direct':
      return { x: 0, y: 0 }
    case 'edge': {
      const a = t * TAU * 0.5
      return { x: Math.cos(a) * 0.8, y: Math.sin(a) * 0.8 }
    }
    case 'elliptical': {
      const a = t * TAU * 0.6
      return { x: Math.cos(a) * 0.85, y: Math.sin(a) * 0.5 }
    }
    case 'concentric': {
      // Step out ring by ring, each ring one full loop, then start over.
      const rings = 3
      const loop = (t * 0.5) % rings
      const ring = Math.floor(loop)
      const a = (loop - ring) * TAU
      const r = 0.25 + (ring / (rings - 1)) * 0.6
      return { x: Math.cos(a) * r, y: Math.sin(a) * r }
    }
    case 'circular':
    default: {
      // Continuous outward spiral that resets — the classic center-out pour.
      const turns = 3
      const phase = (t * 0.5) % 1
      const r = 0.15 + phase * 0.75
      const a = t * TAU * 0.5 * turns
      return { x: Math.cos(a) * r, y: Math.sin(a) * r }
    }
  }
}

/** An SVG path sampling one representative motif of a pattern, as a faint guide trace. */
export function patternGuidePath(p: PourPattern | undefined, scale: number, cx: number, cy: number): string {
  const N = 200
  const span = 20 // seconds of motion to trace (one full motif at the human pace)
  let d = ''
  for (let i = 0; i <= N; i++) {
    const { x, y } = patternPoint(p, (i / N) * span)
    const px = cx + x * scale
    const py = cy + y * scale
    d += `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)} `
  }
  return d.trim()
}
