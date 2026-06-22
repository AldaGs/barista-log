import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Download, Coffee } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
import { decodePayload, fetchSharedCode, importPayload, type SharePayload } from '@/lib/recipeShare'
import { estimateMicrons } from '@/lib/grindConvert'

/**
 * Landing page for shared-recipe links. Supports two link shapes:
 *   /import#<payload>   — self-contained fragment (no backend)
 *   /import?s=<id>      — short link resolved from the backend (Vercel KV)
 * Previews the recipe, then imports.
 */
export default function ImportRecipePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<SharePayload | null>(null)

  useEffect(() => {
    let alive = true
    async function resolve() {
      const fragment = window.location.hash.replace(/^#/, '')
      if (fragment) return decodePayload(fragment)
      const id = new URLSearchParams(window.location.search).get('s')
      if (id) {
        const code = await fetchSharedCode(id)
        return code ? decodePayload(code) : null
      }
      return null
    }
    resolve().then((p) => {
      if (!alive) return
      setPayload(p)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  async function doImport() {
    if (!payload) return
    setBusy(true)
    const id = await importPayload(payload)
    navigate(`/recipe/${id}`, { replace: true })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('import.title')} back />
        <div className="card h-40 animate-pulse" />
      </div>
    )
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
    [t('recipe.grind'), (() => {
      if (r.grindClicks == null) return r.grindLabel
      const microns = estimateMicrons(r.grindClicks, payload.grinder?.micronsPerClick)
      return microns != null ? `${r.grindClicks} · ${t('grinder.microns', { microns })}` : r.grindClicks
    })()],
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
