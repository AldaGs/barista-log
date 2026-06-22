import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Plus, X } from 'lucide-react'
import { db } from '@/db/dexie'
import type { BrewMethod } from '@/db/types'
import { PageHeader, EmptyState } from '@/components/ui'
import { RecipeSummaryCard } from './RecipeSummaryCard'

/** Browse, search and filter the whole recipe library. */
export default function RecipesPage() {
  const { t } = useTranslation()
  const recipes = useLiveQuery(() => db.recipes.orderBy('updatedAt').reverse().toArray(), [])
  const beans = useLiveQuery(() => db.beans.toArray(), [])
  const gear = useLiveQuery(() => db.gear.toArray(), [])

  const [q, setQ] = useState('')
  const [method, setMethod] = useState<BrewMethod | 'all'>('all')
  const [beanId, setBeanId] = useState<string>('all')
  const [gearId, setGearId] = useState<string>('all')

  const beanName = (id?: string) => beans?.find((b) => b.id === id)?.name
  const gearName = (id?: string) => gear?.find((g) => g.id === id)?.name

  // Only offer bean/brewer filters that some recipe actually uses.
  const { beanOptions, gearOptions } = useMemo(() => {
    const usedBeans = new Set((recipes ?? []).map((r) => r.beanId).filter(Boolean))
    const usedGear = new Set((recipes ?? []).map((r) => r.gearId).filter(Boolean))
    return {
      beanOptions: (beans ?? []).filter((b) => usedBeans.has(b.id)),
      gearOptions: (gear ?? []).filter((g) => usedGear.has(g.id)),
    }
  }, [recipes, beans, gear])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (recipes ?? []).filter((r) => {
      if (method !== 'all' && r.method !== method) return false
      if (beanId !== 'all' && r.beanId !== beanId) return false
      if (gearId !== 'all' && r.gearId !== gearId) return false
      if (needle) {
        const hay = [r.title, beanName(r.beanId), gearName(r.gearId), r.brewer, r.notes]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes, beans, gear, q, method, beanId, gearId])

  const loading = recipes === undefined
  const hasAny = (recipes ?? []).length > 0

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('recipes.title')}
        back
        action={
          <Link to="/recipe/new" className="btn-ghost !px-2" aria-label={t('home.newRecipe')}>
            <Plus size={18} />
          </Link>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className="input !pl-9 !pr-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('recipes.search')}
          aria-label={t('recipes.search')}
        />
        {q && (
          <button
            onClick={() => setQ('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text"
            aria-label={t('common.cancel')}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Method filter */}
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

      {/* Bean / brewer filters — only when there's something to pick */}
      {(beanOptions.length > 0 || gearOptions.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {gearOptions.length > 0 && (
            <select className="input !w-auto !py-1.5" value={gearId} onChange={(e) => setGearId(e.target.value)}>
              <option value="all">{t('recipes.allBrewers')}</option>
              {gearOptions.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
          {beanOptions.length > 0 && (
            <select className="input !w-auto !py-1.5" value={beanId} onChange={(e) => setBeanId(e.target.value)}>
              <option value="all">{t('recipes.allBeans')}</option>
              {beanOptions.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {loading ? null : !hasAny ? (
        <EmptyState>
          <p>{t('recipes.empty')}</p>
          <Link to="/recipe/new" className="btn-primary mt-2">
            <Plus size={18} /> {t('home.newRecipe')}
          </Link>
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState>{t('recipes.noMatch')}</EmptyState>
      ) : (
        <>
          <p className="text-xs text-muted">{t('recipes.count', { count: filtered.length })}</p>
          <div className="space-y-3">
            {filtered.map((r) => (
              <RecipeSummaryCard key={r.id} recipe={r} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
