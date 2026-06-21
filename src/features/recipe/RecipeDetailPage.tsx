import { useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Copy, Trash2, Share2, Play, Check } from 'lucide-react'
import { db } from '@/db/dexie'
import { deleteRecipe } from '@/db/repo'
import { PageHeader } from '@/components/ui'
import { RecipeCard } from './RecipeCard'
import { shareRecipePng } from '@/lib/share'

export default function RecipeDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const cardRef = useRef<HTMLDivElement>(null)

  const recipe = useLiveQuery(() => (id ? db.recipes.get(id) : undefined), [id])
  const bean = useLiveQuery(
    () => (recipe?.beanId ? db.beans.get(recipe.beanId) : undefined),
    [recipe?.beanId],
  )

  if (recipe === undefined) return null
  if (!recipe) return <p className="text-muted">Not found.</p>

  return (
    <div className="space-y-4">
      <PageHeader
        title={recipe.title || t('method.' + recipe.method)}
        back
        action={
          <div className="flex gap-1">
            <Link to={`/recipe/${recipe.id}/edit`} className="btn-ghost !px-2" aria-label="edit">
              <Pencil size={18} />
            </Link>
            <Link to={`/recipe/new?from=${recipe.id}`} className="btn-ghost !px-2" aria-label="duplicate">
              <Copy size={18} />
            </Link>
          </div>
        }
      />

      {recipe.method === 'brew' && recipe.steps && recipe.steps.length > 0 ? (
        <div className="flex gap-2">
          <Link to={`/recipe/${recipe.id}/brew`} className="btn-primary flex-1">
            <Play size={18} /> {t('play.title')}
          </Link>
          <Link to={`/recipe/${recipe.id}/log`} className="btn-ghost flex-1">
            <Check size={18} /> {t('session.logBrew')}
          </Link>
        </div>
      ) : (
        <Link to={`/recipe/${recipe.id}/log`} className="btn-ghost w-full">
          <Check size={18} /> {t('session.logBrew')}
        </Link>
      )}

      <div ref={cardRef}>
        <RecipeCard recipe={recipe} beanName={bean?.name} />
      </div>

      <div className="flex gap-2">
        <button
          className="btn-ghost flex-1"
          onClick={() => shareRecipePng(cardRef.current, recipe.title || 'recipe')}
        >
          <Share2 size={18} /> {t('common.share')}
        </button>
        <button
          className="btn-ghost text-red-500"
          onClick={async () => {
            await deleteRecipe(recipe.id)
            navigate('/')
          }}
        >
          <Trash2 size={18} /> {t('common.delete')}
        </button>
      </div>
    </div>
  )
}
