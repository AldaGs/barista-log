import { useEffect, useRef, useState } from 'react'
import { Play, Pause, RotateCcw, Check } from 'lucide-react'
import { formatSeconds } from '@/lib/units'

export function BrewTimer({ onUse }: { onUse?: (seconds: number) => void }) {
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const ref = useRef<number | null>(null)

  useEffect(() => {
    if (running) {
      ref.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    }
    return () => {
      if (ref.current) window.clearInterval(ref.current)
    }
  }, [running])

  return (
    <div className="card flex items-center justify-between gap-3 p-3">
      <span className="font-mono text-2xl tabular-nums">{formatSeconds(seconds)}</span>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost !px-3" onClick={() => setRunning((r) => !r)}>
          {running ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          type="button"
          className="btn-ghost !px-3"
          onClick={() => {
            setRunning(false)
            setSeconds(0)
          }}
        >
          <RotateCcw size={18} />
        </button>
        {onUse && (
          <button type="button" className="btn-primary !px-3" onClick={() => onUse(seconds)}>
            <Check size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
