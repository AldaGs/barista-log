import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Star } from 'lucide-react'

export function PageHeader({
  title,
  back,
  action,
}: {
  title: string
  back?: boolean
  action?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <header className="mb-4 flex items-center gap-3">
      {back && (
        <button onClick={() => navigate('/')} className="btn-ghost !px-2" aria-label="back">
          <ArrowLeft size={20} />
        </button>
      )}
      <h1 className="flex-1 text-2xl font-bold">{title}</h1>
      {action}
    </header>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {hint && <span className="ml-1 font-normal text-muted/70">({hint})</span>}
      </span>
      {children}
    </label>
  )
}

export function StarRating({
  value = 0,
  onChange,
  readOnly,
}: {
  value?: number
  onChange?: (v: number) => void
  readOnly?: boolean
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n === value ? 0 : n)}
          className={n <= value ? 'text-brand' : 'text-border'}
          aria-label={`${n} stars`}
        >
          <Star size={24} fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  )
}

export function ScoreSlider({
  label,
  value = 0,
  onChange,
}: {
  label: string
  value?: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums text-text">{value}/5</span>
      </div>
      <input
        type="range"
        min={0}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[rgb(var(--brand))]"
      />
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center text-muted">
      {children}
    </div>
  )
}
