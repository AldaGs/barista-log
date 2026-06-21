import { toPng } from 'html-to-image'

/**
 * Render a DOM node to PNG and share it via the Web Share API, falling back to
 * a download. Fully offline — no backend needed.
 */
export async function shareRecipePng(node: HTMLElement | null, filename: string) {
  if (!node) return
  const bg = getComputedStyle(document.body).backgroundColor
  const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: bg })
  const blob = await (await fetch(dataUrl)).blob()
  const safe = filename.replace(/[^\w-]+/g, '_').toLowerCase() || 'recipe'
  const file = new File([blob], `${safe}.png`, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Barista Log' })
      return
    } catch {
      /* user cancelled — fall through to download */
    }
  }
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `${safe}.png`
  a.click()
}
