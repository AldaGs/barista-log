import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { Star, GitCompare, Network, Trash2 } from 'lucide-react'
import { db } from '@/db/dexie'
import { deleteSession } from '@/db/repo'
import type { BrewMethod, BrewSession } from '@/db/types'
import { PageHeader, EmptyState } from '@/components/ui'
import { BlobImage } from '@/components/PhotoInput'
import { formatSeconds } from '@/lib/units'
import { RecipeFamilySheet } from '@/features/recipe/RecipeFamilySheet'

export default function HistoryPage() {
  const { t } = useTranslation()
  const [method, setMethod] = useState<BrewMethod | 'all'>('all')
  const [familyOf, setFamilyOf] = useState<string | null>(null)

  const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray(), [])
  const recipes = useLiveQuery(() => db.recipes.toArray(), [])
  const beans = useLiveQuery(() => db.beans.toArray(), [])
  const beanName = (id?: string) => beans?.find((b) => b.id === id)?.name

  // Sessions are already newest-first from the query; keep that order always.
  const filtered = (sessions ?? []).filter((s) => method === 'all' || s.method === method)

  // Recipe ids that sit in a fork lineage — either a fork themselves or having
  // forks — so we only offer the family-tree overlay where it's meaningful.
  const familyIds = useMemo(() => {
    const ids = new Set<string>()
    for (const r of recipes ?? []) {
      if (r.forkedFromId) {
        ids.add(r.id)
        ids.add(r.forkedFromId)
      }
    }
    return ids
  }, [recipes])

  function SessionRow({ s }: { s: BrewSession }) {
    const hasFamily = !!s.recipeId && familyIds.has(s.recipeId)
    return (
      <Link
        to={s.recipeId ? `/recipe/${s.recipeId}` : '/history'}
        className="card flex items-center justify-between gap-3 p-4 hover:border-brand"
      >
        {s.photo && (
          <BlobImage blob={s.photo} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{s.params?.title || t('method.' + s.method)}</p>
          <p className="text-sm text-muted">
            {format(s.date, 'PP')} · {beanName(s.beanId) ?? '—'}
            {s.params?.ratio ? ` · 1:${s.params.ratio}` : ''}
          </p>
          {(s.tds != null || s.beverageWeight != null || s.actualTotalSec != null || s.actualSteepHours != null) && (
            <p className="mt-1 text-xs tabular-nums text-muted">
              {[
                s.actualTotalSec != null
                  ? t('history.actualValue', { value: formatSeconds(s.actualTotalSec) })
                  : null,
                s.actualSteepHours != null
                  ? t('history.steepValue', { value: s.actualSteepHours })
                  : null,
                s.tds != null ? t('history.tdsValue', { value: s.tds }) : null,
                s.beverageWeight != null ? t('history.bevValue', { value: s.beverageWeight }) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {s.flavorTags && s.flavorTags.length > 0 && (
            <p className="mt-1 text-xs text-muted">{s.flavorTags.join(', ')}</p>
          )}
          {s.notes?.trim() && (
            <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs italic text-muted">
              {s.notes}
            </p>
          )}
        </div>
        {s.rating ? (
          <span className="inline-flex items-center gap-1 text-brand">
            <Star size={16} fill="currentColor" /> {s.rating}
          </span>
        ) : null}
        {hasFamily && (
          <button
            className="shrink-0 text-muted hover:text-brand"
            aria-label={t('recipe.familyTree')}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setFamilyOf(s.recipeId!)
            }}
          >
            <Network size={18} />
          </button>
        )}
        <button
          className="shrink-0 text-muted hover:text-red-500"
          aria-label={t('common.delete')}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (confirm(t('history.confirmDelete'))) deleteSession(s.id)
          }}
        >
          <Trash2 size={18} />
        </button>
      </Link>
    )
  }

  const loading = sessions === undefined || recipes === undefined

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

      {/* method filter */}
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

      {loading ? null : filtered.length === 0 ? (
        <EmptyState>{t('history.empty')}</EmptyState>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <SessionRow key={s.id} s={s} />
          ))}
        </div>
      )}

      {familyOf && (
        <RecipeFamilySheet recipeId={familyOf} onClose={() => setFamilyOf(null)} />
      )}
    </div>
  )
}
