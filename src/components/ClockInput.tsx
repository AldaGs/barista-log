/** Two digit-only fields (min : sec) that read/write a total seconds value. */
export function ClockInput({
  value,
  onChange,
  className = '',
}: {
  value: number | undefined
  onChange: (seconds: number | undefined) => void
  className?: string
}) {
  const min = value == null ? '' : Math.floor(value / 60)
  const sec = value == null ? '' : value % 60

  const compose = (m: number | '', s: number | '') => {
    if (m === '' && s === '') return onChange(undefined)
    onChange((Number(m) || 0) * 60 + (Number(s) || 0))
  }

  const digits = (v: string) => (v === '' ? '' : Math.max(0, Math.floor(Number(v) || 0)))

  return (
    <div className={`flex items-center gap-1 rounded-xl border border-border bg-surface px-2 ${className}`}>
      <input
        className="w-full bg-transparent py-2 text-center tabular-nums outline-none"
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min={0}
        placeholder="0"
        aria-label="minutes"
        value={min}
        onChange={(e) => compose(digits(e.target.value), sec === '' ? '' : sec)}
      />
      <span className="select-none text-muted">:</span>
      <input
        className="w-full bg-transparent py-2 text-center tabular-nums outline-none"
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min={0}
        max={59}
        placeholder="00"
        aria-label="seconds"
        value={sec === '' ? '' : String(sec).padStart(2, '0')}
        onChange={(e) => {
          const s = digits(e.target.value)
          compose(min === '' ? '' : min, s === '' ? '' : Math.min(59, s))
        }}
      />
    </div>
  )
}
