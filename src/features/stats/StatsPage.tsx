import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { startOfWeek, subWeeks, format } from 'date-fns'
import { Star, AlertTriangle } from 'lucide-react'
import { db } from '@/db/dexie'
import { PageHeader, EmptyState } from '@/components/ui'
import { measuredBrew } from '@/lib/brewModel'
import { freshness, stock } from '@/lib/freshness'

const WEEKS = 12

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card flex-1 p-3 text-center">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  )
}

/** Vertical bar mini-chart. */
function Bars({ data, color = 'rgb(var(--brand))' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex h-28 items-end gap-1">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] tabular-nums text-muted">{d.value || ''}</span>
          <div
            className="w-full rounded-t"
            style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0, backgroundColor: color }}
          />
          <span className="text-[9px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function StatsPage() {
  const { t } = useTranslation()
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const recipes = useLiveQuery(() => db.recipes.toArray(), [])
  const beans = useLiveQuery(() => db.beans.toArray(), [])

  const s = useMemo(() => {
    const all = sessions ?? []
    const recipeById = new Map((recipes ?? []).map((r) => [r.id, r]))
    const beanById = new Map((beans ?? []).map((b) => [b.id, b]))
    const now = Date.now()
    const weekMs = 7 * 86_400_000

    // weekly brew counts (last WEEKS weeks, oldest → newest)
    const weekStart = startOfWeek(subWeeks(now, WEEKS - 1)).getTime()
    const weekly = Array.from({ length: WEEKS }, (_, i) => ({
      label: format(new Date(weekStart + i * weekMs), 'd/M'),
      value: 0,
    }))
    for (const x of all) {
      const idx = Math.floor((startOfWeek(x.date).getTime() - weekStart) / weekMs)
      if (idx >= 0 && idx < WEEKS) weekly[idx].value++
    }

    // rating distribution + average
    const ratings = all.filter((x) => x.rating && x.rating > 0)
    const ratingDist = [1, 2, 3, 4, 5].map((n) => ({
      label: String(n),
      value: ratings.filter((x) => x.rating === n).length,
    }))
    const avgRating = ratings.length
      ? ratings.reduce((a, x) => a + (x.rating ?? 0), 0) / ratings.length
      : 0

    // method split
    const espresso = all.filter((x) => x.method === 'espresso').length
    const brew = all.length - espresso

    // last 7 / 30 days
    const last7 = all.filter((x) => now - x.date <= 7 * 86_400_000).length
    const last30 = all.filter((x) => now - x.date <= 30 * 86_400_000).length

    // counts by recipe / bean
    const byRecipe = new Map<string, { title: string; count: number }>()
    for (const x of all) {
      if (!x.recipeId) continue
      const r = recipeById.get(x.recipeId)
      const title = r?.title || x.params?.title || t('method.' + x.method)
      const cur = byRecipe.get(x.recipeId) ?? { title, count: 0 }
      cur.count++
      byRecipe.set(x.recipeId, cur)
    }
    const topRecipes = [...byRecipe.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)

    const byBean = new Map<string, number>()
    for (const x of all) {
      if (!x.beanId) continue
      byBean.set(x.beanId, (byBean.get(x.beanId) ?? 0) + 1)
    }
    const topBeans = [...byBean.entries()]
      .map(([id, count]) => ({ name: beanById.get(id)?.name ?? '—', count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // flavor tag frequency
    const tagFreq = new Map<string, number>()
    for (const x of all) for (const tag of x.flavorTags ?? []) tagFreq.set(tag, (tagFreq.get(tag) ?? 0) + 1)
    const topTags = [...tagFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)

    // measured extraction
    const measured = all.map(measuredBrew).filter((p): p is NonNullable<typeof p> => p !== null)
    const avgExt = measured.length ? measured.reduce((a, p) => a + p.extraction, 0) / measured.length : null

    // bean alerts
    const lowBeans = (beans ?? []).filter((b) => stock(b).isLow || stock(b).isEmpty)
    const restingBeans = (beans ?? []).filter((b) => freshness(b).status === 'resting')

    return {
      total: all.length,
      last7,
      last30,
      avgRating,
      weekly,
      ratingDist,
      espresso,
      brew,
      topRecipes,
      topBeans,
      topTags,
      avgExt,
      measuredCount: measured.length,
      lowBeans,
      restingBeans,
    }
  }, [sessions, recipes, beans, t])

  if (sessions === undefined) return null

  return (
    <div className="space-y-4">
      <PageHeader title={t('stats.title')} back />

      {s.total === 0 ? (
        <EmptyState>{t('stats.empty')}</EmptyState>
      ) : (
        <>
          <div className="flex gap-2">
            <Stat value={String(s.total)} label={t('stats.totalBrews')} />
            <Stat value={String(s.last7)} label={t('stats.last7')} />
            <Stat value={s.avgRating ? s.avgRating.toFixed(1) : '—'} label={t('stats.avgRating')} />
          </div>

          <Section title={t('stats.brewsPerWeek')}>
            <Bars data={s.weekly} />
          </Section>

          {(s.espresso > 0 || s.brew > 0) && (
            <Section title={t('stats.methodSplit')}>
              <div className="space-y-2">
                {[
                  { label: t('method.espresso'), value: s.espresso, color: 'rgb(var(--brand))' },
                  { label: t('method.brew'), value: s.brew, color: 'rgb(var(--accent))' },
                ].map((m) => (
                  <div key={m.label} className="flex items-center gap-2 text-sm">
                    <span className="w-20 shrink-0 text-muted">{m.label}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(m.value / s.total) * 100}%`, backgroundColor: m.color }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right tabular-nums text-muted">{m.value}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {s.ratingDist.some((r) => r.value > 0) && (
            <Section title={t('stats.ratingDist')}>
              <Bars data={s.ratingDist} color="rgb(var(--accent))" />
            </Section>
          )}

          {s.measuredCount > 0 && (
            <Section title={t('stats.extraction')}>
              <p className="text-sm text-muted">
                {t('stats.avgExtraction', {
                  ext: s.avgExt!.toFixed(1),
                  count: s.measuredCount,
                })}
              </p>
            </Section>
          )}

          {s.topRecipes.length > 0 && (
            <Section title={t('stats.topRecipes')}>
              <ul className="space-y-1.5">
                {s.topRecipes.map(([id, r]) => (
                  <li key={id} className="flex items-center justify-between text-sm">
                    <Link to={`/recipe/${id}`} className="truncate hover:text-brand">{r.title}</Link>
                    <span className="ml-2 shrink-0 tabular-nums text-muted">{t('stats.brewsN', { count: r.count })}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {s.topBeans.length > 0 && (
            <Section title={t('stats.topBeans')}>
              <ul className="space-y-1.5">
                {s.topBeans.map((b, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate">{b.name}</span>
                    <span className="ml-2 shrink-0 tabular-nums text-muted">{t('stats.brewsN', { count: b.count })}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {s.topTags.length > 0 && (
            <Section title={t('stats.topFlavors')}>
              <div className="flex flex-wrap gap-2">
                {s.topTags.map(([tag, count]) => (
                  <span key={tag} className="chip">
                    {tag} <span className="text-muted">· {count}</span>
                  </span>
                ))}
              </div>
            </Section>
          )}

          {(s.lowBeans.length > 0 || s.restingBeans.length > 0) && (
            <Section title={t('stats.beanAlerts')}>
              <ul className="space-y-1.5 text-sm">
                {s.lowBeans.map((b) => (
                  <li key={`low-${b.id}`} className="flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0 text-amber-500" />
                    <span className="truncate">{b.name}</span>
                    <span className="ml-auto shrink-0 text-muted">
                      {stock(b).isEmpty ? t('beans.empty2') : t('beans.gramsLeft', { grams: stock(b).grams })}
                    </span>
                  </li>
                ))}
                {s.restingBeans.map((b) => {
                  const f = freshness(b)
                  return (
                    <li key={`rest-${b.id}`} className="flex items-center gap-2">
                      <Star size={14} className="shrink-0 text-amber-500" />
                      <span className="truncate">{b.name}</span>
                      <span className="ml-auto shrink-0 text-muted">
                        {t('beans.freshness.restingDays', { count: Math.max(f.restDays - (f.ageDays ?? 0), 0) })}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  )
}
