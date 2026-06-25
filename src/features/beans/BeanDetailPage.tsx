import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, Coffee, Pencil } from 'lucide-react'
import { db } from '@/db/dexie'
import { deleteCupping } from '@/db/repo'
import { PageHeader, EmptyState } from '@/components/ui'

/** Bean detail: summary header + the bean's SCA cupping scores. */
export default function BeanDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const bean = useLiveQuery(() => (id ? db.beans.get(id) : undefined), [id])
  const cuppings = useLiveQuery(
    () => (id ? db.cuppings.where('beanId').equals(id).reverse().sortBy('date') : []),
    [id],
  )

  if (bean === undefined) return null
  if (!bean) return <p className="text-muted">{t('common.notFound')}</p>

  const scored = (cuppings ?? []).filter((c) => c.score != null)
  const avg = scored.length
    ? Math.round((scored.reduce((s, c) => s + (c.score ?? 0), 0) / scored.length) * 100) / 100
    : null

  return (
    <div className="space-y-4">
      <PageHeader title={bean.name} back />

      <div className="card p-4">
        <p className="text-sm text-muted">
          {[bean.roaster, bean.origin, bean.process].filter(Boolean).join(' · ') || '—'}
        </p>
        {avg != null && (
          <p className="mt-2 text-2xl font-bold tabular-nums text-brand">
            {avg.toFixed(2)} <span className="text-sm font-normal text-muted">{t('cupping.avgScore', { count: scored.length })}</span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t('cupping.title')}</h2>
        <Link to={`/bean/${bean.id}/cup`} className="btn-primary">
          <Plus size={18} /> {t('cupping.newCupping')}
        </Link>
      </div>

      {cuppings === undefined ? null : cuppings.length === 0 ? (
        <EmptyState><Coffee /> {t('cupping.empty')}</EmptyState>
      ) : (
        <div className="space-y-2">
          {cuppings.map((c) => (
            <div key={c.id} className="card flex items-center justify-between gap-3 p-3">
              <Link to={`/cupping/${c.id}/edit`} className="min-w-0 flex-1">
                <p className="text-lg font-bold tabular-nums text-brand">
                  {(c.score ?? 0).toFixed(2)} <span className="text-xs font-normal text-muted">/ 100</span>
                </p>
                <p className="text-sm text-muted">{new Date(c.date).toLocaleDateString()}</p>
              </Link>
              <Link to={`/cupping/${c.id}/edit`} className="shrink-0 text-muted hover:text-brand" aria-label={t('common.edit')}>
                <Pencil size={18} />
              </Link>
              <button className="shrink-0 text-muted hover:text-red-500" onClick={() => deleteCupping(c.id)} aria-label={t('common.delete')}>
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
