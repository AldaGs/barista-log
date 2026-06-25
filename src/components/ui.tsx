import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Star } from 'lucide-react'
import { TAB_ROOT, tabForPath } from '@/store/navTabs'

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
  const location = useLocation()
  // Native-style hierarchical back: a sub-window steps to its parent (browser
  // history when available, else the tab root); a tab root drops to Home.
  const goBack = () => {
    const tab = tabForPath(location.pathname)
    const atTabRoot = location.pathname === TAB_ROOT[tab]
    if (atTabRoot) {
      navigate('/')
    } else if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate(TAB_ROOT[tab])
    }
  }
  return (
    <header className="mb-4 flex items-center gap-3">
      {back && (
        <button onClick={goBack} className="btn-ghost !px-2" aria-label="back">
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
  min = 0,
  max = 5,
  step = 1,
}: {
  label: string
  value?: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums text-text">{value}/{max}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
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
