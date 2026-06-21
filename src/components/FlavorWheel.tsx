import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { FLAVOR_WHEEL, langOf } from '@/lib/flavorWheel'

/** Point on a circle (angle in radians, 0 = +x axis). */
function pt(cx: number, cy: number, r: number, a: number) {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
}

/** Donut-segment path between two radii and two angles. */
function wedge(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const big = a1 - a0 > Math.PI ? 1 : 0
  const [x0, y0] = pt(cx, cy, r1, a0)
  const [x1, y1] = pt(cx, cy, r1, a1)
  const [x2, y2] = pt(cx, cy, r0, a1)
  const [x3, y3] = pt(cx, cy, r0, a0)
  return `M${x0} ${y0} A${r1} ${r1} 0 ${big} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${big} 0 ${x3} ${y3} Z`
}

/**
 * Radial SCA flavor-wheel picker. The donut shows the nine categories as colored
 * slices; tap a slice to reveal its descriptors as chips. Tapping a descriptor
 * toggles it in/out of the selected tags (same string[] as the free-text input).
 */
export function FlavorWheel({
  value,
  onChange,
}: {
  value: string[]
  onChange: (tags: string[]) => void
}) {
  const { t, i18n } = useTranslation()
  const lang = langOf(i18n.language)
  const [openKey, setOpenKey] = useState<string | null>(null)

  const toggle = (label: string) =>
    onChange(value.includes(label) ? value.filter((x) => x !== label) : [...value, label])

  const C = 130
  const r0 = 52
  const r1 = 120
  const n = FLAVOR_WHEEL.length
  const step = (2 * Math.PI) / n
  const start = -Math.PI / 2 - step / 2 // first slice centered at top

  const active = FLAVOR_WHEEL.find((c) => c.key === openKey)
  const activeCount = active ? active.flavors.filter((fl) => value.includes(fl[lang])).length : 0
  const centerLines = active ? active.labels[lang].split(' / ') : [t('session.flavorWheel')]

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${C * 2} ${C * 2}`} className="mx-auto block w-full max-w-[280px]" role="group">
        {FLAVOR_WHEEL.map((cat, i) => {
          const a0 = start + i * step
          const a1 = a0 + step
          const isOpen = openKey === cat.key
          const count = cat.flavors.filter((fl) => value.includes(fl[lang])).length
          const [mx, my] = pt(C, C, (r0 + r1) / 2, a0 + step / 2)
          return (
            <g key={cat.key} onClick={() => setOpenKey(isOpen ? null : cat.key)} className="cursor-pointer">
              <path
                d={wedge(C, C, r0, isOpen ? r1 + 6 : r1, a0 + 0.012, a1 - 0.012)}
                fill={cat.color}
                fillOpacity={isOpen ? 1 : count > 0 ? 0.85 : 0.6}
                stroke={isOpen ? '#fff' : 'none'}
                strokeWidth={isOpen ? 2 : 0}
              />
              {count > 0 && (
                <circle cx={mx} cy={my} r={9} fill="#fff" fillOpacity={0.92}>
                  <title>{`${cat.labels[lang]}: ${count}`}</title>
                </circle>
              )}
              {count > 0 && (
                <text x={mx} y={my + 3.5} textAnchor="middle" fontSize="11" fontWeight="700" fill={cat.color}>
                  {count}
                </text>
              )}
            </g>
          )
        })}

        {/* center label */}
        <circle cx={C} cy={C} r={r0 - 4} fill="rgb(var(--surface))" stroke="rgb(var(--border))" />
        {centerLines.map((line, i) => (
          <text
            key={i}
            x={C}
            y={C + (i - (centerLines.length - 1) / 2) * 14 + (active ? -4 : 4)}
            textAnchor="middle"
            fontSize={active ? '13' : '12'}
            fontWeight={active ? '700' : '500'}
            fill={active ? active.color : 'rgb(var(--muted))'}
          >
            {line}
          </text>
        ))}
        {active && activeCount > 0 && (
          <text x={C} y={C + 16} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))">
            {activeCount}
          </text>
        )}
      </svg>

      {active && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-2">
          {active.flavors.map((fl) => {
            const label = fl[lang]
            const selected = value.includes(label)
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggle(label)}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm transition"
                style={{
                  color: selected ? '#fff' : active.color,
                  backgroundColor: selected ? active.color : `${active.color}14`,
                  border: `1px solid ${active.color}55`,
                }}
              >
                {selected && <Check size={13} />}
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
