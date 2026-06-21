import { toPng } from 'html-to-image'

/**
 * Render a DOM node to PNG and share it via the Web Share API, falling back to
 * a download. Fully offline — no backend needed.
 */
export async function shareRecipePng(node: HTMLElement | null, filename: string) {
  if (!node) return
  // Measure the actual rendered box so html-to-image doesn't mis-size the
  // capture (which shifts content up and crops the bottom). Leave the
  // background transparent so the card's rounded corners stay see-through —
  // looks cleaner when shared to Instagram.
  const rect = node.getBoundingClientRect()
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    backgroundColor: undefined,
    width: Math.ceil(rect.width),
    height: Math.ceil(rect.height),
    // The captured node inherits a margin from its space-y-* parent; html-to-image
    // keeps it on the clone, shifting content down (blank strip on top, crop at
    // bottom). Zero it out on the clone root.
    style: { margin: '0' },
  })
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
