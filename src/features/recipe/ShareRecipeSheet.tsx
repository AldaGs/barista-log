import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'
import { X, Copy, Check, Share2 } from 'lucide-react'
import type { Recipe } from '@/db/types'
import { buildSharePayload, encodePayload, shareUrl } from '@/lib/recipeShare'

/** Modal that turns a recipe into an importable link + QR code (no backend). */
export function ShareRecipeSheet({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    buildSharePayload(recipe).then((payload) => {
      const u = shareUrl(encodePayload(payload))
      if (!alive) return
      setUrl(u)
      // Level 'L' + a wide render keeps the modules large and low-density so
      // budget phone cameras can lock on.
      QRCode.toDataURL(u, { width: 640, margin: 2, errorCorrectionLevel: 'L' })
        .then((d) => alive && setQr(d))
        .catch(() => {})
    })
    return () => {
      alive = false
    }
  }, [recipe])

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const nativeShare = async () => {
    try {
      await navigator.share({ title: recipe.title || 'Recipe', url })
    } catch {
      /* cancelled */
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-t-2xl bg-surface p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('share.recipeTitle')}</h2>
          <button onClick={onClose} className="btn-ghost !px-2" aria-label={t('common.cancel')}>
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-muted">{t('share.recipeHint')}</p>

        <div className="flex justify-center">
          {qr ? (
            <img src={qr} alt="QR" className="h-56 w-56 rounded-xl bg-white p-2" />
          ) : (
            <div className="h-56 w-56 animate-pulse rounded-xl bg-surface-2" />
          )}
        </div>

        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={copy} disabled={!url}>
            {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? t('share.copied') : t('share.copyLink')}
          </button>
          {typeof navigator.share === 'function' && (
            <button className="btn-primary flex-1" onClick={nativeShare} disabled={!url}>
              <Share2 size={18} /> {t('common.share')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
