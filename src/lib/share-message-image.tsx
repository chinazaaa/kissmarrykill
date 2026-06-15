'use client'

import { createRoot } from 'react-dom/client'
import { toBlob } from 'html-to-image'
import { ShareMessageCard } from '@/components/secret-message/ShareMessageCard'

export interface SecretMessageShareImageOptions {
  messageText: string
  gameTitle: string
  headerEmoji?: string
  brand?: string
}

/** Renders a branded share card by capturing real site CSS as a PNG blob. */
export async function renderSecretMessageShareImage({
  messageText,
  gameTitle,
  headerEmoji,
  brand = 'fateround.com',
}: SecretMessageShareImageOptions): Promise<Blob> {
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.pointerEvents = 'none'
  host.style.zIndex = '-1'
  document.body.appendChild(host)

  const mount = document.createElement('div')
  host.appendChild(mount)

  const root = createRoot(mount)

  try {
    root.render(
      <ShareMessageCard
        messageText={messageText}
        gameTitle={gameTitle}
        headerEmoji={headerEmoji}
        brand={brand}
      />
    )

    await document.fonts.ready
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const node = mount.firstElementChild as HTMLElement | null
    if (!node) throw new Error('Could not render share card')

    const blob = await toBlob(node, {
      pixelRatio: 1,
      cacheBust: true,
      skipAutoScale: true,
    })

    if (!blob) throw new Error('Could not create image')
    return blob
  } finally {
    root.unmount()
    host.remove()
  }
}
