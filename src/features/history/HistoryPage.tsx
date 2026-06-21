import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { Star, GitCompare } from 'lucide-react'
import { db } from '@/db/dexie'
import type { BrewMethod } from '@/db/types'
import { PageHeader, EmptyState } from '@/components/ui'

export default function HistoryPage() {
  const { t } = useTranslation()
  const [method, setMethod] = useState<BrewMethod | 'all'>('all')
  const sessions = useLiveQuery(
    () => db.sessions.orderBy('date').reverse().toArray(),
    [],
  )
  const beans = useLiveQuery(() => db.beans.toArray(), [])
  const beanName = (id?: string) => beans?.find((b) => b.id === id)?.name

  const filtered = (sessions ?? []).filter((s) => method === 'all' || s.method === method)

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('history.title')}
        action={
          filtered.length >= 2 ? (
            <Link to="/compare" className="btn-ghost !px-3">
              <GitCompare size={18} /> {t('history.compare')}
            </Link>
          ) : undefined
        }
      />

      <div className="flex gap-2">
        {(['all', 'espresso', 'brew'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`chip ${method === m ? '!bg-brand !text-brand-fg' : ''}`}
          >
            {m === 'all' ? t('history.filterAll') : t('method.' + m)}
          </button>
        ))}
      </div>

      {sessions === undefined ? null : filtered.length === 0 ? (
        <EmptyState>{t('history.empty')}</EmptyState>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <Link
              key={s.id}
              to={s.recipeId ? `/recipe/${s.recipeId}` : '/history'}
              className="card flex items-center justify-between p-4 hover:border-brand"
            >
              <div>
                <p className="font-medium">{s.params?.title || t('method.' + s.method)}</p>
                <p className="text-sm text-muted">
                  {format(s.date, 'PP')} · {beanName(s.beanId) ?? '—'}
                  {s.params?.ratio ? ` · 1:${s.params.ratio}` : ''}
                </p>
                {s.flavorTags && s.flavorTags.length > 0 && (
                  <p className="mt-1 text-xs text-muted">{s.flavorTags.join(', ')}</p>
                )}
              </div>
              {s.rating ? (
                <span className="inline-flex items-center gap-1 text-brand">
                  <Star size={16} fill="currentColor" /> {s.rating}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
