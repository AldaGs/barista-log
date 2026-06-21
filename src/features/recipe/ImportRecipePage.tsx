import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Download, Coffee } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
import { decodePayload, importPayload } from '@/lib/recipeShare'

/** Landing page for shared-recipe links: /import#<payload>. Previews then imports. */
export default function ImportRecipePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const payload = useMemo(() => {
    const code = window.location.hash.replace(/^#/, '')
    return code ? decodePayload(code) : null
  }, [])

  async function doImport() {
    if (!payload) return
    setBusy(true)
    const id = await importPayload(payload)
    navigate(`/recipe/${id}`, { replace: true })
  }

  if (!payload) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('import.title')} back />
        <EmptyState>{t('import.invalid')}</EmptyState>
      </div>
    )
  }

  const r = payload.recipe
  const rows: [string, string | number | undefined][] = [
    [t('recipe.ratio'), r.ratio ? `1:${r.ratio}` : undefined],
    [t('recipe.doseIn'), r.doseIn],
    [r.method === 'espresso' ? t('recipe.yieldOut') : t('recipe.waterAmount'), r.yieldOut],
    [t('recipe.grind'), r.grindClicks ?? r.grindLabel],
  ]

  return (
    <div className="space-y-4">
      <PageHeader title={t('import.title')} back />

      <div className="card overflow-hidden">
        <div className="bg-brand px-4 py-3 text-brand-fg">
          <p className="text-xs uppercase tracking-wide opacity-80">{t('method.' + r.method)}</p>
          <h2 className="text-xl font-bold">{r.title || t('method.' + r.method)}</h2>
        </div>
        <div className="space-y-1.5 px-4 py-3 text-sm">
          {rows.filter(([, v]) => v != null && v !== '').map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-muted">{k}</span>
              <span className="font-medium tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {(payload.bean || payload.gear || payload.grinder || payload.water) && (
        <div className="card space-y-1.5 p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('import.bundled')}</p>
          {payload.bean && <p className="flex items-center gap-2"><Coffee size={14} /> {payload.bean.name}</p>}
          {payload.gear && <p>{payload.gear.name}</p>}
          {payload.grinder && <p>{payload.grinder.name}</p>}
          {payload.water && <p>{payload.water.name}</p>}
          <p className="pt-1 text-xs text-muted">{t('import.bundledHint')}</p>
        </div>
      )}

      <button className="btn-primary w-full" onClick={doImport} disabled={busy}>
        <Download size={18} /> {busy ? t('import.importing') : t('import.action')}
      </button>
    </div>
  )
}
