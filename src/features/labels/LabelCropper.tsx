import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Check } from 'lucide-react'

/**
 * Square crop modal: shows the picked image inside a fixed frame the user can
 * pan (drag) and zoom (slider), then exports the framed region as a JPEG Blob.
 * The image is always scaled to *cover* the frame, so there are never empty
 * bars — panning/zooming just chooses which part of the bag to keep.
 */
const OUT = 1000 // exported square edge, px

export function LabelCropper({
  file,
  onCancel,
  onCrop,
}: {
  file: File
  onCancel: () => void
  onCrop: (blob: Blob) => void
}) {
  const { t } = useTranslation()
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [frame, setFrame] = useState(280)
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  // Load the picked file into an Image once.
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const i = new Image()
    i.onload = () => setImg(i)
    i.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Measure the on-screen frame so the math matches what the user sees.
  useEffect(() => {
    if (frameRef.current) setFrame(frameRef.current.clientWidth)
  }, [img])

  if (!img) return null

  const base = Math.max(frame / img.width, frame / img.height)
  const s = base * zoom
  const dispW = img.width * s
  const dispH = img.height * s

  // Clamp the offset so the image always covers the frame (no gaps).
  const clamp = (x: number, y: number) => ({
    x: Math.min(0, Math.max(frame - dispW, x)),
    y: Math.min(0, Math.max(frame - dispH, y)),
  })

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const nx = drag.current.ox + (e.clientX - drag.current.x)
    const ny = drag.current.oy + (e.clientY - drag.current.y)
    setOff(clamp(nx, ny))
  }
  const onPointerUp = () => {
    drag.current = null
  }

  const onZoom = (z: number) => {
    setZoom(z)
    // Re-clamp against the new size, keeping the frame covered.
    const nbase = Math.max(frame / img.width, frame / img.height)
    const ns = nbase * z
    setOff((o) => ({
      x: Math.min(0, Math.max(frame - img.width * ns, o.x)),
      y: Math.min(0, Math.max(frame - img.height * ns, o.y)),
    }))
  }

  async function crop() {
    setBusy(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = OUT
      canvas.height = OUT
      const ctx = canvas.getContext('2d')!
      // Source rect (original-image coords) currently inside the frame.
      const sx = -off.x / s
      const sy = -off.y / s
      const sSize = frame / s
      ctx.drawImage(img!, sx, sy, sSize, sSize, 0, 0, OUT, OUT)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
      if (blob) onCrop(blob)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onCancel}>
      <div className="w-full max-w-md space-y-4 rounded-t-2xl bg-surface p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('labels.crop')}</h2>
          <button onClick={onCancel} className="btn-ghost !px-2" aria-label={t('common.cancel')}>
            <X size={18} />
          </button>
        </div>

        <div
          ref={frameRef}
          className="relative aspect-square w-full touch-none overflow-hidden rounded-xl bg-surface-2 select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <img
            src={img.src}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              left: off.x,
              top: off.y,
              width: dispW,
              height: dispH,
              maxWidth: 'none',
            }}
          />
        </div>

        <label className="block">
          <span className="label">{t('labels.zoom')}</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(e) => onZoom(Number(e.target.value))}
            className="w-full accent-[rgb(var(--brand))]"
          />
        </label>

        <button className="btn-primary w-full" disabled={busy} onClick={crop}>
          <Check size={18} /> {t('labels.save')}
        </button>
      </div>
    </div>
  )
}
