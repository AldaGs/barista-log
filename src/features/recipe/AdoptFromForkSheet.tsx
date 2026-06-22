import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, GitMerge, ArrowRight } from 'lucide-react'
import { db } from '@/db/dexie'
import type { Recipe } from '@/db/types'
import { saveRecipe } from '@/db/repo'
import { formatSeconds } from '@/lib/units'

/** Recipe fields that can be adopted from a fork back into its parent. */
type FieldKey = keyof Recipe

interface FieldDef {
  field: FieldKey
  labelKey: string
  /** Human-readable cell value; relations resolve ids to names via `names`. */
  display: (r: Recipe, names: Names) => string | undefined
}

interface Names {
  beans: Map<string, string>
  waters: Map<string, string>
  grinders: Map<string, string>
  gear: Map<string, string>
}

const FIELDS: FieldDef[] = [
  { field: 'method', labelKey: 'method.label', display: (r) => r.method },
  { field: 'beanId', labelKey: 'recipe.bean', display: (r, n) => (r.beanId ? n.beans.get(r.beanId) : undefined) },
  { field: 'waterId', labelKey: 'recipe.water', display: (r, n) => (r.waterId ? n.waters.get(r.waterId) : undefined) },
  { field: 'grinderId', labelKey: 'recipe.grinder', display: (r, n) => (r.grinderId ? n.grinders.get(r.grinderId) : undefined) },
  { field: 'gearId', labelKey: 'gear.title', display: (r, n) => (r.gearId ? n.gear.get(r.gearId) : undefined) },
  { field: 'grindClicks', labelKey: 'recipe.grind', display: (r) => r.grindClicks?.toString() },
  { field: 'doseIn', labelKey: 'recipe.doseIn', display: (r) => r.doseIn?.toString() },
  { field: 'yieldOut', labelKey: 'recipe.yieldOut', display: (r) => r.yieldOut?.toString() },
  { field: 'waterTemp', labelKey: 'recipe.waterTemp', display: (r) => r.waterTemp?.toString() },
  { field: 'shotTimeSec', labelKey: 'recipe.shotTime', display: (r) => (r.shotTimeSec != null ? formatSeconds(r.shotTimeSec) : undefined) },
  { field: 'totalTimeSec', labelKey: 'recipe.totalTime', display: (r) => (r.totalTimeSec != null ? formatSeconds(r.totalTimeSec) : undefined) },
  { field: 'steepHours', labelKey: 'coldbrew.steepHours', display: (r) => r.steepHours?.toString() },
  { field: 'dilutionRatio', labelKey: 'coldbrew.dilution', display: (r) => (r.dilutionRatio != null ? `1:${r.dilutionRatio}` : undefined) },
  { field: 'iceGrams', labelKey: 'coldbrew.ice', display: (r) => r.iceGrams?.toString() },
  { field: 'steps', labelKey: 'recipe.steps', display: (r) => (r.steps?.length ? `${r.steps.length}` : undefined) },
  { field: 'notes', labelKey: 'recipe.notes', display: (r) => r.notes?.trim() || undefined },
]

const same = (a: unknown, b: unknown) =>
  typeof a === 'object' || typeof b === 'object'
    ? JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
    : (a ?? undefined) === (b ?? undefined)

/** Pull selected field values from a fork up into its parent recipe. */
export function AdoptFromForkSheet({
  fork,
  parent,
  onClose,
}: {
  fork: Recipe
  parent: Recipe
  onClose: () => void
}) {
  const { t } = useTranslation()
  const names = useLiveQuery(async () => {
    const [beans, waters, grinders, gear] = await Promise.all([
      db.beans.toArray(),
      db.waters.toArray(),
      db.grinders.toArray(),
      db.gear.toArray(),
    ])
    return {
      beans: new Map(beans.map((x) => [x.id, x.name])),
      waters: new Map(waters.map((x) => [x.id, x.name])),
      grinders: new Map(grinders.map((x) => [x.id, x.name])),
      gear: new Map(gear.map((x) => [x.id, x.name])),
    } as Names
  }, [])

  const diffs = useMemo(
    () => FIELDS.filter((f) => !same(fork[f.field], parent[f.field])),
    [fork, parent],
  )
  const [picked, setPicked] = useState<Set<FieldKey>>(() => new Set(diffs.map((d) => d.field)))
  const toggle = (f: FieldKey) =>
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })

  const apply = async () => {
    const updates: Partial<Recipe> = {}
    for (const d of diffs) {
      if (picked.has(d.field)) (updates as Record<string, unknown>)[d.field] = fork[d.field]
    }
    await saveRecipe({ ...parent, ...updates, id: parent.id })
    onClose()
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
          <h2 className="text-lg font-bold">{t('recipe.adopt.title')}</h2>
          <button onClick={onClose} className="btn-ghost !px-2" aria-label={t('common.cancel')}>
            <X size={18} />
          </button>
        </div>

        {names === undefined ? null : diffs.length === 0 ? (
          <p className="text-sm text-muted">{t('recipe.adopt.noDiff')}</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              {t('recipe.adopt.hint', { title: parent.title || t('method.' + parent.method) })}
            </p>
            <div className="-mx-1 flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="p-1 font-medium" />
                    <th className="p-1 font-medium">{t('recipe.adopt.parent')}</th>
                    <th className="p-1 font-medium">{t('recipe.adopt.fork')}</th>
                  </tr>
                </thead>
                <tbody>
                  {diffs.map((d) => {
                    const on = picked.has(d.field)
                    return (
                      <tr
                        key={d.field as string}
                        className="cursor-pointer border-t border-border/50"
                        onClick={() => toggle(d.field)}
                      >
                        <td className="p-1.5">
                          <input
                            type="checkbox"
                            checked={on}
                            readOnly
                            aria-label={t(d.labelKey)}
                            className="accent-brand"
                          />
                        </td>
                        <td className="p-1.5">
                          <span className="block text-xs text-muted">{t(d.labelKey)}</span>
                          <span className="tabular-nums">
                            {d.display(parent, names) ?? '—'}
                          </span>
                        </td>
                        <td className={`p-1.5 tabular-nums ${on ? 'text-brand' : ''}`}>
                          <span className="inline-flex items-center gap-1">
                            <ArrowRight size={12} className="shrink-0 text-muted" />
                            {d.display(fork, names) ?? '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button className="btn-primary w-full" onClick={apply} disabled={picked.size === 0}>
              <GitMerge size={18} /> {t('recipe.adopt.apply', { count: picked.size })}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
