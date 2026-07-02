import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Plus, BarChart3, HelpCircle, Search } from 'lucide-react'
import { db } from '@/db/dexie'
import { RecipeSummaryCard } from '@/features/recipe/RecipeSummaryCard'
import { EmptyState } from '@/components/ui'
import { HomeNudges } from '@/components/HomeNudges'

export default function HomePage() {
  const { t } = useTranslation()

  const recipes = useLiveQuery(
    () => db.recipes.orderBy('updatedAt').reverse().toArray(),
    [],
  )

  const latest = recipes?.[0]
  // Pinned recipes (minus the featured latest, to avoid showing it twice).
  const favorites = (recipes ?? []).filter((r) => r.id !== latest?.id && r.favorite)
  const favIds = new Set(favorites.map((r) => r.id))
  // Recent excludes the latest and anything already pinned above.
  const recent = (recipes ?? []).slice(1, 7).filter((r) => !favIds.has(r.id))

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[1.9rem] font-semibold tracking-tight">{t('app.name')}</h1>
        <div className="flex items-center gap-2">
          <Link to="/recipes" className="btn-ghost !px-2" aria-label={t('recipes.title')}>
            <Search size={18} />
          </Link>
          <Link to="/stats" className="btn-ghost !px-2" aria-label={t('stats.title')}>
            <BarChart3 size={18} />
          </Link>
          <Link to="/recipe/new" className="btn-primary">
            <Plus size={18} /> {t('home.newRecipe')}
          </Link>
        </div>
      </header>

      <HomeNudges hasData={!!latest} />

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
          <Link to="/help" className="mt-1 inline-flex items-center gap-1.5 text-sm text-brand">
            <HelpCircle size={16} /> {t('home.firstRunHelp')}
          </Link>
        </EmptyState>
      )}

      {favorites.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {t('home.favorites')}
          </h2>
          <div className="space-y-3">
            {favorites.map((r, i) => (
              <RecipeSummaryCard key={r.id} recipe={r} index={i} />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {t('home.recent')}
            </h2>
            <Link to="/recipes" className="text-sm text-brand">
              {t('recipes.seeAll')}
            </Link>
          </div>
          <div className="space-y-3">
            {recent.map((r, i) => (
              <RecipeSummaryCard key={r.id} recipe={r} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Visible privacy/terms footer — keeps the legal links plainly reachable
          on the home page for users and for Google OAuth verification. */}
      <footer className="border-t border-border pt-4 text-center text-xs text-muted">
        <a className="underline hover:text-text" href="/privacy.html">
          {t('settings.privacyPolicy')}
        </a>
        <span className="px-2">·</span>
        <a className="underline hover:text-text" href="/terms.html">
          {t('settings.termsOfService')}
        </a>
      </footer>
    </div>
  )
}
