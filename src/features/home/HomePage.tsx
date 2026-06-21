import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { db } from '@/db/dexie'
import { RecipeSummaryCard } from '@/features/recipe/RecipeSummaryCard'
import { EmptyState } from '@/components/ui'

export default function HomePage() {
  const { t } = useTranslation()
  const recipes = useLiveQuery(
    () => db.recipes.orderBy('updatedAt').reverse().limit(6).toArray(),
    [],
  )

  const latest = recipes?.[0]
  const recent = recipes?.slice(1) ?? []

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('app.name')}</h1>
        <Link to="/recipe/new" className="btn-primary">
          <Plus size={18} /> {t('home.newRecipe')}
        </Link>
      </header>

      {recipes === undefined ? null : latest ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {t('home.latest')}
          </h2>
          <RecipeSummaryCard recipe={latest} featured />
        </section>
      ) : (
        <EmptyState>
          <p>{t('home.empty')}</p>
          <Link to="/recipe/new" className="btn-primary mt-2">
            <Plus size={18} /> {t('home.newRecipe')}
          </Link>
        </EmptyState>
      )}

      {recent.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {t('home.recent')}
          </h2>
          <div className="space-y-3">
            {recent.map((r) => (
              <RecipeSummaryCard key={r.id} recipe={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
