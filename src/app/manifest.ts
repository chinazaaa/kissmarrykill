import type { MetadataRoute } from 'next'
import { SITE_NAME, DEFAULT_DESCRIPTION } from '@/lib/seo'

/**
 * PWA web app manifest. Next serves this at /manifest.webmanifest and injects
 * the <link rel="manifest"> tag automatically. Signals installability and
 * app-like intent to Google and mobile browsers.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Free Online Party Games`,
    short_name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0b0f',
    theme_color: '#f43f5e',
    categories: ['games', 'entertainment', 'social'],
    icons: [
      {
        src: '/icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
