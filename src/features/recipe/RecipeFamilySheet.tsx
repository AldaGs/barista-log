import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, GitFork } from 'lucide-react'
import { db } from '@/db/dexie'
import type { Recipe } from '@/db/types'

/** Horizontal indent (px) added per nesting level, capped at MAX_INDENT_DEPTH. */
const INDENT_STEP = 10
/** Levels deeper than this stop indenting so long chains stay on-screen. */
const MAX_INDENT_DEPTH = 4

/** A recipe and its forked-from children, for the lineage tree. */
interface FamilyNode {
  recipe: Recipe
  children: FamilyNode[]
}

/** Walk up `forkedFromId` to the topmost ancestor of `id` (cycle-safe). */
function rootOf(id: string, byId: Map<string, Recipe>): string {
  const seen = new Set<string>()
  let cur = id
  while (true) {
    if (seen.has(cur)) break
    seen.add(cur)
    const parentId = byId.get(cur)?.forkedFromId
    if (!parentId || !byId.has(parentId)) break
    cur = parentId
  }
  return cur
}

/** Build the subtree rooted at `rootId` from the recipe list. */
function buildTree(rootId: string, recipes: Recipe[]): FamilyNode | null {
  const root = recipes.find((r) => r.id === rootId)
  if (!root) return null
  const childrenOf = new Map<string, Recipe[]>()
  for (const r of recipes) {
    if (!r.forkedFromId) continue
    const arr = childrenOf.get(r.forkedFromId) ?? []
    arr.push(r)
    childrenOf.set(r.forkedFromId, arr)
  }
  const make = (r: Recipe, seen: Set<string>): FamilyNode => {
    seen.add(r.id)
    const kids = (childrenOf.get(r.id) ?? [])
      .filter((c) => !seen.has(c.id))
      .map((c) => make(c, seen))
    return { recipe: r, children: kids }
  }
  return make(root, new Set())
}

/**
 * Read-only overlay showing the fork lineage that `recipeId` belongs to, with
 * the focused recipe highlighted ("this recipe"). Tapping any other node closes
 * the sheet and navigates to that recipe.
 */
export function RecipeFamilySheet({
  recipeId,
  onClose,
}: {
  recipeId: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const recipes = useLiveQuery(() => db.recipes.toArray(), [])

  const tree = useMemo(() => {
    if (!recipes) return null
    const byId = new Map(recipes.map((r) => [r.id, r]))
    if (!byId.has(recipeId)) return null
    return buildTree(rootOf(recipeId, byId), recipes)
  }, [recipes, recipeId])

  const Row = ({ node, depth }: { node: FamilyNode; depth: number }) => {
    const isCurrent = node.recipe.id === recipeId
    const isFork = !!node.recipe.forkedFromId
    const title = node.recipe.title || t('method.' + node.recipe.method)
    // Indentation compounds through nesting, so to keep deep (often linear)
    // lineages from running off-screen we only add a step up to MAX_INDENT_DEPTH;
    // deeper levels add none and align under that cap.
    const indented = depth > 0 && depth <= MAX_INDENT_DEPTH
    const inner = (
      <div className="flex min-w-0 items-center gap-2">
        {isFork && <GitFork size={14} className="shrink-0 text-muted" />}
        <span className="truncate font-medium">{title}</span>
        {isCurrent && (
          <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-brand-fg">
            {t('recipe.family.thisRecipe')}
          </span>
        )}
      </div>
    )
    return (
      <div
        style={indented ? { marginLeft: INDENT_STEP } : undefined}
        className={indented ? 'border-l border-border/60 pl-1.5' : ''}
      >
        {isCurrent ? (
          <div className="card flex items-center p-3 ring-1 ring-brand">{inner}</div>
        ) : (
          <Link
            to={`/recipe/${node.recipe.id}`}
            onClick={onClose}
            className="card flex items-center p-3 hover:border-brand"
          >
            {inner}
          </Link>
        )}
        {node.children.length > 0 && (
          <div className="mt-2 space-y-2">
            {node.children.map((c) => (
              <Row key={c.recipe.id} node={c} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 rounded-t-2xl bg-surface p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('recipe.family.title')}</h2>
          <button onClick={onClose} className="btn-ghost !px-2" aria-label={t('common.cancel')}>
            <X size={18} />
          </button>
        </div>

        {recipes === undefined ? null : !tree ? (
          <p className="text-sm text-muted">{t('recipe.family.empty')}</p>
        ) : (
          <>
            <p className="text-sm text-muted">{t('recipe.family.subtitle')}</p>
            <div className="-mx-1 min-h-0 flex-1 space-y-2 overflow-y-auto px-1">
              <Row node={tree} depth={0} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
