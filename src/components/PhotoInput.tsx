import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, X } from 'lucide-react'

/** Downscale an image file to a JPEG Blob (max edge ~1280px) to keep storage small. */
async function downscale(file: File, maxEdge = 1280, quality = 0.8): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
    return blob ?? file
  } catch {
    return file // fall back to the original if anything goes wrong
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Renders a Blob/File as an <img>, managing the object URL lifecycle. */
export function BlobImage({ blob, className, alt = '' }: { blob: Blob; className?: string; alt?: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url ? <img src={url} alt={alt} className={className} /> : null
}

/** Photo capture/preview field. Stores a downscaled JPEG Blob. */
export function PhotoInput({
  value,
  onChange,
}: {
  value?: Blob
  onChange: (blob: Blob | undefined) => void
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setBusy(true)
    try {
      onChange(await downscale(file))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      {value ? (
        <div className="relative inline-block">
          <BlobImage blob={value} className="max-h-48 rounded-xl border border-border object-cover" alt={t('session.photo')} />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
            aria-label={t('common.delete')}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button type="button" className="btn-ghost w-full" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Camera size={18} /> {busy ? t('session.photoBusy') : t('session.addPhoto')}
        </button>
      )}
    </div>
  )
}
