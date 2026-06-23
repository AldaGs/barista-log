import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Plus, BarChart3, HelpCircle, Search, Info } from 'lucide-react'
import { db } from '@/db/dexie'
import { RecipeSummaryCard } from '@/features/recipe/RecipeSummaryCard'
import { EmptyState } from '@/components/ui'
import { HomeNudges } from '@/components/HomeNudges'

export default function HomePage() {
  const { t } = useTranslation()
  const [infoOpen, setInfoOpen] = useState(false)
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
        <h1 className="text-2xl font-bold">{t('app.name')}</h1>
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
          {/* Info menu — privacy/terms links. The panel is always mounted (just
              CSS-hidden when closed) so the links stay in the rendered DOM for
              Google OAuth verification crawlers. */}
          <div className="relative">
            <button
              type="button"
              className="btn-ghost !px-2"
              aria-label={t('home.about')}
              aria-expanded={infoOpen}
              onClick={() => setInfoOpen((o) => !o)}
            >
              <Info size={18} />
            </button>
            <div
              className={`absolute right-0 top-full z-10 mt-1 w-44 rounded-xl border border-border bg-surface p-2 text-sm shadow-lg ${
                infoOpen ? 'block' : 'hidden'
              }`}
            >
              <a className="block rounded-lg px-2 py-1.5 hover:bg-surface-2" href="/privacy.html">
                {t('settings.privacyPolicy')}
              </a>
              <a className="block rounded-lg px-2 py-1.5 hover:bg-surface-2" href="/terms.html">
                {t('settings.termsOfService')}
              </a>
            </div>
          </div>
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
            {favorites.map((r) => (
              <RecipeSummaryCard key={r.id} recipe={r} />
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
            {recent.map((r) => (
              <RecipeSummaryCard key={r.id} recipe={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
