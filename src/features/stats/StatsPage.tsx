import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { startOfWeek, subWeeks, subMonths, format } from 'date-fns'
import { Star, AlertTriangle, Flame } from 'lucide-react'
import { db } from '@/db/dexie'
import { PageHeader, EmptyState } from '@/components/ui'
import { measuredBrew } from '@/lib/brewModel'
import { freshness, stock } from '@/lib/freshness'
import { formatSeconds } from '@/lib/units'
import { useSettings } from '@/store/settings'

const WEEKS = 12
const MONTHS = 12
const DAY_MS = 86_400_000

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
  const costTracking = useSettings((s) => s.costTracking)
  const currency = useSettings((s) => s.currency)
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const recipes = useLiveQuery(() => db.recipes.toArray(), [])
  const beans = useLiveQuery(() => db.beans.toArray(), [])
  const practice = useLiveQuery(() => db.practice.toArray(), [])
  const [period, setPeriod] = useState<'weeks' | 'months'>('weeks')

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

    // monthly brew counts (last MONTHS months, oldest → newest)
    const monthly = Array.from({ length: MONTHS }, (_, i) => ({
      label: format(subMonths(now, MONTHS - 1 - i), 'MMM'),
      value: 0,
    }))
    const monthIndex = (d: number) => {
      const dt = new Date(d)
      const cur = new Date(now)
      return (cur.getFullYear() - dt.getFullYear()) * 12 + (cur.getMonth() - dt.getMonth())
    }
    for (const x of all) {
      const back = monthIndex(x.date)
      if (back >= 0 && back < MONTHS) monthly[MONTHS - 1 - back].value++
    }
    const busiestMonth = all.length
      ? (() => {
          const byMonth = new Map<string, number>()
          for (const x of all) {
            const key = format(x.date, 'yyyy-MM')
            byMonth.set(key, (byMonth.get(key) ?? 0) + 1)
          }
          const [key, count] = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0]
          return { label: format(new Date(key + '-01'), 'MMMM yyyy'), count }
        })()
      : null

    // when-you-brew patterns: day-of-week (0=Sun) and hour-of-day distributions
    const dow = Array.from({ length: 7 }, (_, i) => ({ label: 'SMTWTFS'[i], value: 0 }))
    const hours = new Array(24).fill(0)
    for (const x of all) {
      const d = new Date(x.date)
      dow[d.getDay()].value++
      hours[d.getHours()]++
    }
    // 4-hour buckets for a compact hour chart (mobile-friendly)
    const hourBuckets = Array.from({ length: 6 }, (_, i) => ({
      label: ['12a', '4a', '8a', '12p', '4p', '8p'][i],
      value: hours.slice(i * 4, i * 4 + 4).reduce((a, b) => a + b, 0),
    }))
    const peakDow = all.length ? dow.reduce((m, d, i) => (d.value > dow[m].value ? i : m), 0) : null
    const peakHour = all.length ? hours.reduce((m, v, i) => (v > hours[m] ? i : m), 0) : null

    // brewing streak: consecutive calendar days with ≥1 brew (current + longest)
    const dayKeys = [...new Set(all.map((x) => Math.floor(x.date / DAY_MS)))].sort((a, b) => a - b)
    let longestStreak = 0
    let curRun = 0
    for (let i = 0; i < dayKeys.length; i++) {
      curRun = i > 0 && dayKeys[i] - dayKeys[i - 1] === 1 ? curRun + 1 : 1
      longestStreak = Math.max(longestStreak, curRun)
    }
    const today = Math.floor(now / DAY_MS)
    let currentStreak = 0
    if (dayKeys.length) {
      const last = dayKeys[dayKeys.length - 1]
      if (last === today || last === today - 1) {
        currentStreak = 1
        for (let i = dayKeys.length - 1; i > 0; i--) {
          if (dayKeys[i] - dayKeys[i - 1] === 1) currentStreak++
          else break
        }
      }
    }

    // favorite by depletion: bean drunk fastest (g/day), needs a started bag
    const depletion = (beans ?? [])
      .map((b) => {
        if (!b.bagSize || b.gramsRemaining == null) return null
        const consumed = b.bagSize - b.gramsRemaining
        if (consumed <= 0) return null
        const beanSessions = all.filter((x) => x.beanId === b.id)
        const firstAt = beanSessions.length
          ? Math.min(...beanSessions.map((x) => x.date))
          : b.createdAt
        const days = Math.max((now - firstAt) / DAY_MS, 1)
        return { name: b.name, perDay: consumed / days }
      })
      .filter((x): x is { name: string; perDay: number } => x !== null)
      .sort((a, b) => b.perDay - a.perDay)
    const fastestBean = depletion[0] ?? null

    // practice (pour drill) totals
    const practiceAll = practice ?? []
    const practiceSec = practiceAll.reduce((a, p) => a + (p.durationSec ?? 0), 0)

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
    const coldbrew = all.filter((x) => x.method === 'coldbrew').length
    const brew = all.length - espresso - coldbrew

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

    // actual brew timing (captured by the guided player)
    const timed = all.filter((x) => x.actualTotalSec != null)
    const avgActualSec = timed.length
      ? Math.round(timed.reduce((a, x) => a + (x.actualTotalSec ?? 0), 0) / timed.length)
      : null
    // deviation from each brew's planned total (or espresso shot) time
    const deltas = timed
      .map((x) => {
        const plan = x.params?.totalTimeSec ?? x.params?.shotTimeSec
        return plan ? (x.actualTotalSec as number) - plan : null
      })
      .filter((d): d is number => d !== null)
    const avgDeltaSec = deltas.length
      ? Math.round(deltas.reduce((a, d) => a + d, 0) / deltas.length)
      : null

    // cost (opt-in): per-brew coffee cost = dose × bag price / bag size.
    let coffeeSpend = 0
    let costedBrews = 0
    let spend30 = 0
    for (const x of all) {
      const b = x.beanId ? beanById.get(x.beanId) : undefined
      const dose = x.params?.doseIn
      if (!b?.price || !b.bagSize || !dose) continue
      const cost = (b.price / b.bagSize) * dose
      coffeeSpend += cost
      costedBrews++
      if (now - x.date <= 30 * 86_400_000) spend30 += cost
    }
    const avgPerCup = costedBrews ? coffeeSpend / costedBrews : null

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
      coldbrew,
      topRecipes,
      topBeans,
      topTags,
      avgExt,
      measuredCount: measured.length,
      avgActualSec,
      timedCount: timed.length,
      avgDeltaSec,
      deltaCount: deltas.length,
      coffeeSpend,
      avgPerCup,
      spend30,
      costedBrews,
      monthly,
      busiestMonth,
      dow,
      hourBuckets,
      peakDow,
      peakHour,
      currentStreak,
      longestStreak,
      fastestBean,
      practiceSec,
      practiceCount: practiceAll.length,
      lowBeans,
      restingBeans,
    }
  }, [sessions, recipes, beans, practice, t])

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

          <Section title={period === 'weeks' ? t('stats.brewsPerWeek') : t('stats.brewsPerMonth')}>
            <div className="mb-3 flex gap-2">
              {(['weeks', 'months'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-full px-3 py-1 text-xs ${period === p ? 'bg-brand text-white' : 'bg-surface-2 text-muted'}`}
                >
                  {t('stats.period.' + p)}
                </button>
              ))}
            </div>
            <Bars data={period === 'weeks' ? s.weekly : s.monthly} />
          </Section>

          {(s.currentStreak > 0 || s.longestStreak > 1) && (
            <div className="flex gap-2">
              <Stat value={t('stats.daysN', { count: s.currentStreak })} label={t('stats.currentStreak')} />
              <Stat value={t('stats.daysN', { count: s.longestStreak })} label={t('stats.longestStreak')} />
              {s.busiestMonth && <Stat value={String(s.busiestMonth.count)} label={t('stats.busiestMonth', { month: s.busiestMonth.label })} />}
            </div>
          )}

          {s.peakDow != null && s.peakHour != null && (
            <Section title={t('stats.whenYouBrew')}>
              <p className="flex items-center gap-2 text-sm">
                <Flame size={16} className="shrink-0 text-brand" />
                <span>
                  {t('stats.peakCallout', {
                    day: format(new Date(2024, 0, 7 + s.peakDow), 'EEEE'),
                    hour: format(new Date(2024, 0, 1, s.peakHour), 'h a'),
                  })}
                </span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 text-xs text-muted">{t('stats.byDay')}</p>
                  <Bars data={s.dow} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted">{t('stats.byHour')}</p>
                  <Bars data={s.hourBuckets} color="rgb(var(--accent))" />
                </div>
              </div>
            </Section>
          )}

          {s.fastestBean && (
            <Section title={t('stats.fastestBean')}>
              <p className="flex items-center justify-between text-sm">
                <span className="truncate font-medium">{s.fastestBean.name}</span>
                <span className="shrink-0 tabular-nums text-muted">{t('stats.gPerDay', { g: s.fastestBean.perDay.toFixed(1) })}</span>
              </p>
              <p className="mt-1 text-xs text-muted">{t('stats.fastestBeanHint')}</p>
            </Section>
          )}

          {s.practiceCount > 0 && (
            <Section title={t('stats.practice')}>
              <div className="flex gap-2">
                <Stat value={formatSeconds(s.practiceSec)} label={t('stats.practiceTime')} />
                <Stat value={String(s.practiceCount)} label={t('stats.practiceSessions')} />
              </div>
            </Section>
          )}

          {(s.espresso > 0 || s.brew > 0 || s.coldbrew > 0) && (
            <Section title={t('stats.methodSplit')}>
              <div className="space-y-2">
                {[
                  { label: t('method.espresso'), value: s.espresso, color: 'rgb(var(--brand))' },
                  { label: t('method.brew'), value: s.brew, color: 'rgb(var(--accent))' },
                  { label: t('method.coldbrew'), value: s.coldbrew, color: 'rgb(56 189 248)' },
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

          {s.avgActualSec != null && (
            <Section title={t('stats.timing')}>
              <p className="text-sm text-muted">
                {t('stats.avgActual', {
                  time: formatSeconds(s.avgActualSec),
                  count: s.timedCount,
                })}
              </p>
              {s.avgDeltaSec != null && (
                <p className="text-sm text-muted">
                  {s.avgDeltaSec === 0
                    ? t('stats.onPlan', { count: s.deltaCount })
                    : t(s.avgDeltaSec > 0 ? 'stats.runsLong' : 'stats.runsShort', {
                        delta: formatSeconds(Math.abs(s.avgDeltaSec)),
                        count: s.deltaCount,
                      })}
                </p>
              )}
            </Section>
          )}

          {costTracking && s.costedBrews > 0 && (
            <Section title={t('stats.cost')}>
              <div className="flex gap-2">
                <Stat value={`${currency}${s.avgPerCup!.toFixed(2)}`} label={t('stats.costPerCup')} />
                <Stat value={`${currency}${s.spend30.toFixed(2)}`} label={t('stats.cost30')} />
                <Stat value={`${currency}${s.coffeeSpend.toFixed(2)}`} label={t('stats.costTotal')} />
              </div>
              <p className="text-xs text-muted">{t('stats.costNote', { count: s.costedBrews })}</p>
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
