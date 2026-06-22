import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { Star, GitCompare, GitFork, ChevronRight, Trash2 } from 'lucide-react'
import { db } from '@/db/dexie'
import { deleteSession } from '@/db/repo'
import type { BrewMethod, BrewSession, Recipe } from '@/db/types'
import { PageHeader, EmptyState } from '@/components/ui'
import { BlobImage } from '@/components/PhotoInput'

type View = 'all' | 'group'

/** A recipe with its own sessions and its forked-from children. */
interface Node {
  recipe: Recipe
  sessions: BrewSession[]
  children: Node[]
}

/** Total sessions in a node's whole subtree (so empty parents of brewed forks still show). */
function subtreeCount(n: Node): number {
  return n.sessions.length + n.children.reduce((s, c) => s + subtreeCount(c), 0)
}

export default function HistoryPage() {
  const { t } = useTranslation()
  const [method, setMethod] = useState<BrewMethod | 'all'>('all')
  const [view, setView] = useState<View>('group')
  const [open, setOpen] = useState<Set<string>>(new Set())

  const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray(), [])
  const recipes = useLiveQuery(() => db.recipes.toArray(), [])
  const beans = useLiveQuery(() => db.beans.toArray(), [])
  const beanName = (id?: string) => beans?.find((b) => b.id === id)?.name

  const filtered = (sessions ?? []).filter((s) => method === 'all' || s.method === method)

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Build the lineage forest: recipes as nodes, forks nested under their parent.
  const { roots, orphanSessions } = useMemo(() => {
    const recs = recipes ?? []
    const byId = new Map(recs.map((r) => [r.id, r]))
    const sessionsByRecipe = new Map<string, BrewSession[]>()
    const orphans: BrewSession[] = []
    for (const s of filtered) {
      if (s.recipeId && byId.has(s.recipeId)) {
        const arr = sessionsByRecipe.get(s.recipeId) ?? []
        arr.push(s)
        sessionsByRecipe.set(s.recipeId, arr)
      } else {
        orphans.push(s)
      }
    }

    const nodes = new Map<string, Node>(
      recs.map((r) => [r.id, { recipe: r, sessions: sessionsByRecipe.get(r.id) ?? [], children: [] }]),
    )
    const tops: Node[] = []
    for (const node of nodes.values()) {
      const parentId = node.recipe.forkedFromId
      const parent = parentId ? nodes.get(parentId) : undefined
      if (parent) parent.children.push(node)
      else tops.push(node)
    }

    // Keep only branches that contain at least one matching session, and respect
    // the method filter at the recipe level too.
    const prune = (n: Node): Node | null => {
      const children = n.children.map(prune).filter((c): c is Node => c !== null)
      const node = { ...n, children }
      const methodOk = method === 'all' || n.recipe.method === method
      if ((node.sessions.length > 0 && methodOk) || children.length > 0) return node
      return null
    }
    const roots = tops
      .map(prune)
      .filter((n): n is Node => n !== null)
      .sort((a, b) => subtreeCount(b) - subtreeCount(a))

    return { roots, orphanSessions: orphans }
  }, [recipes, filtered, method])

  function SessionRow({ s }: { s: BrewSession }) {
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
          {(s.tds != null || s.beverageWeight != null) && (
            <p className="mt-1 text-xs tabular-nums text-muted">
              {[
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

  function RecipeNode({ node, depth }: { node: Node; depth: number }) {
    const isOpen = open.has(node.recipe.id)
    const count = node.sessions.length
    const isFork = !!node.recipe.forkedFromId
    return (
      <div style={depth > 0 ? { marginLeft: 12 } : undefined} className={depth > 0 ? 'border-l border-border/60 pl-2' : ''}>
        <button
          onClick={() => toggle(node.recipe.id)}
          className="card flex w-full items-center justify-between p-4 text-left hover:border-brand"
        >
          <div className="flex items-center gap-2">
            <ChevronRight
              size={16}
              className={`shrink-0 text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`}
            />
            {isFork && <GitFork size={14} className="shrink-0 text-muted" />}
            <div>
              <p className="font-medium">{node.recipe.title || t('method.' + node.recipe.method)}</p>
              <p className="text-sm text-muted">
                {t('history.brewCount', { count })}
                {node.children.length > 0 ? ` · ${t('history.forkCount', { count: node.children.length })}` : ''}
              </p>
            </div>
          </div>
          <Link
            to={`/recipe/${node.recipe.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-brand"
          >
            {t('common.open')}
          </Link>
        </button>
        {isOpen && (
          <div className="mt-2 space-y-2">
            {node.sessions.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
            {node.children.map((c) => (
              <RecipeNode key={c.recipe.id} node={c} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const loading = sessions === undefined || recipes === undefined
  const groupEmpty = roots.length === 0 && orphanSessions.length === 0

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

      {/* view toggle: Group / All */}
      <div className="flex gap-2">
        {(['group', 'all'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`chip ${view === v ? '!bg-brand !text-brand-fg' : ''}`}
          >
            {t('history.view.' + v)}
          </button>
        ))}
      </div>

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

      {loading ? null : view === 'all' ? (
        filtered.length === 0 ? (
          <EmptyState>{t('history.empty')}</EmptyState>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </div>
        )
      ) : groupEmpty ? (
        <EmptyState>{t('history.empty')}</EmptyState>
      ) : (
        <div className="space-y-3">
          {roots.map((n) => (
            <RecipeNode key={n.recipe.id} node={n} depth={0} />
          ))}
          {orphanSessions.length > 0 && (
            <div>
              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
                {t('history.unlinked')}
              </p>
              <div className="space-y-2">
                {orphanSessions.map((s) => (
                  <SessionRow key={s.id} s={s} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
