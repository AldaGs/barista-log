import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { db } from '@/db/dexie'
import type { BrewSession } from '@/db/types'
import { PageHeader, EmptyState } from '@/components/ui'
import { formatSeconds } from '@/lib/units'

const ROWS: { key: string; get: (s: BrewSession) => string | number | undefined }[] = [
  { key: 'method.label', get: (s) => s.method },
  { key: 'recipe.ratio', get: (s) => (s.params?.ratio ? `1:${s.params.ratio}` : undefined) },
  { key: 'recipe.doseIn', get: (s) => s.params?.doseIn },
  { key: 'recipe.yieldOut', get: (s) => s.params?.yieldOut },
  { key: 'recipe.grind', get: (s) => s.params?.grindClicks },
  { key: 'recipe.waterTemp', get: (s) => s.params?.waterTemp },
  { key: 'recipe.shotTime', get: (s) => formatSeconds(s.params?.shotTimeSec ?? s.params?.totalTimeSec) },
  { key: 'session.actualTitle', get: (s) => (s.actualTotalSec != null ? formatSeconds(s.actualTotalSec) : undefined) },
  { key: 'session.rating', get: (s) => s.rating },
  { key: 'session.acidity', get: (s) => s.flavors?.acidity },
  { key: 'session.body', get: (s) => s.flavors?.body },
  { key: 'session.sweetness', get: (s) => s.flavors?.sweetness },
  { key: 'session.bitterness', get: (s) => s.flavors?.bitterness },
]

export default function ComparePage() {
  const { t } = useTranslation()
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray(), [])
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const chosen = (sessions ?? []).filter((s) => selected.includes(s.id))

  return (
    <div className="space-y-4">
      <PageHeader title={t('compare.title')} back />

      {sessions === undefined ? null : sessions.length < 2 ? (
        <EmptyState>{t('compare.needTwo')}</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`chip ${selected.includes(s.id) ? '!bg-brand !text-brand-fg' : ''}`}
              >
                {s.params?.title || t('method.' + s.method)} · {format(s.date, 'MMM d')}
              </button>
            ))}
          </div>

          {chosen.length >= 2 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="p-2 font-medium text-muted">{t('compare.field')}</th>
                    {chosen.map((s) => (
                      <th key={s.id} className="p-2 font-medium">
                        <span className="block">{s.params?.title || t('method.' + s.method)}</span>
                        <span className="block text-xs font-normal text-muted">
                          {format(s.date, 'MMM d')}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.key} className="border-b border-border/50 last:border-0">
                      <td className="p-2 text-muted">{t(row.key)}</td>
                      {chosen.map((s) => {
                        const v = row.get(s)
                        const display =
                          row.key === 'method.label' && typeof v === 'string' ? t('method.' + v) : v
                        return (
                          <td key={s.id} className="p-2 tabular-nums">
                            {display ?? '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
