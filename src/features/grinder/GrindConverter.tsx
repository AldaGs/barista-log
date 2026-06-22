import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, AlertTriangle, Info } from 'lucide-react'
import { db } from '@/db/dexie'
import { convertGrind, convertFromMicrons, methodsForMicrons } from '@/lib/grindConvert'

/**
 * Pivot-through-microns grind converter. Used standalone on the Grinders page
 * and inline inside the recipe form ("dialing at a friend's house").
 */
export function GrindConverter({
  defaultToId,
  onApply,
}: {
  defaultToId?: string
  onApply?: (clicks: number, grinderId: string) => void
}) {
  const { t } = useTranslation()
  const grinders = useLiveQuery(() => db.grinders.orderBy('name').toArray(), [])
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState(defaultToId ?? '')
  const [clicks, setClicks] = useState<number | ''>('')

  const MICRONS = '__microns__'
  const fromMicrons = fromId === MICRONS
  const from = grinders?.find((g) => g.id === fromId)
  const to = grinders?.find((g) => g.id === toId)

  const result = useMemo(() => {
    if (!to || clicks === '') return null
    if (fromMicrons) return convertFromMicrons(Number(clicks), to)
    if (!from) return null
    return convertGrind(from, Number(clicks), to)
  }, [from, to, clicks, fromMicrons])

  return (
    <div className="card space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">{t('grinder.from')}</span>
          <select className="input" value={fromId} onChange={(e) => setFromId(e.target.value)}>
            <option value="">—</option>
            <option value={MICRONS}>{t('grinder.micronsDirect')}</option>
            {grinders?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">{t('grinder.to')}</span>
          <select className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">—</option>
            {grinders?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="label">
          {fromMicrons ? t('grinder.micronsLabel') : `${t('recipe.grind')} (${t('recipe.clicks')})`}
        </span>
        <input
          className="input"
          type="number"
          inputMode="decimal"
          value={clicks}
          onChange={(e) => setClicks(e.target.value === '' ? '' : Number(e.target.value))}
        />
      </label>

      {result && to && (
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="flex items-center justify-center gap-3 text-lg font-semibold">
            <span>{fromMicrons ? t('grinder.microns', { microns: clicks }) : `${clicks} ${t('recipe.clicks')}`}</span>
            <ArrowRight size={18} className="text-muted" />
            <span className="text-brand">
              {result.targetClicksRounded} {t('recipe.clicks')}
            </span>
          </div>
          <p className="mt-1 text-center text-xs text-muted">
            {t('grinder.microns', { microns: result.microns })}
          </p>
          {methodsForMicrons(result.microns).length > 0 && (
            <p className="mt-1 text-center text-xs text-muted">
              {t('grinder.landsIn')}:{' '}
              {methodsForMicrons(result.microns)
                .map((m) => t(`band.${m}`))
                .join(', ')}
            </p>
          )}
          {onApply && (
            <button
              type="button"
              className="btn-primary mt-2 w-full"
              onClick={() => onApply(result.targetClicksRounded, to.id)}
            >
              {t('common.add')} → {t('recipe.grind')}
            </button>
          )}
        </div>
      )}

      {result?.confidence === 'rough' && (
        <p className="flex gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {t('grinder.roughWarning')}
        </p>
      )}
      {result && (from?.estimated || to?.estimated) && (
        <p className="flex gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {t('grinder.estimatedWarning')}
        </p>
      )}
      <p className="flex gap-2 text-xs text-muted">
        <Info size={14} className="mt-0.5 shrink-0" />
        {t('grinder.disclaimer')}
      </p>
    </div>
  )
}
