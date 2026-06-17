'use client'

import { toBlob } from 'html-to-image'
import { appDomain } from '@/lib/site'
import { appendShareBranding } from '@/lib/append-share-branding'

/** Captures a live DOM node and appends fateround.com branding for marketing. */
export async function captureElementAsImage(
  element: HTMLElement,
  { brand = appDomain(), pixelRatio = 2 }: { brand?: string; pixelRatio?: number } = {}
): Promise<Blob> {
  await document.fonts.ready
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || '#f4f4f7'

  const blob = await toBlob(element, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: bg,
  })

  if (!blob) throw new Error('Could not create image')
  return appendShareBranding(blob, { brand, backgroundColor: bg, pixelRatio })
}
