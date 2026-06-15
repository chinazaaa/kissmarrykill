'use client'

import { toBlob } from 'html-to-image'

/** Captures a live DOM node exactly as rendered on screen. */
export async function captureElementAsImage(element: HTMLElement): Promise<Blob> {
  await document.fonts.ready
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || '#f4f4f7'

  const blob = await toBlob(element, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: bg,
  })

  if (!blob) throw new Error('Could not create image')
  return blob
}
