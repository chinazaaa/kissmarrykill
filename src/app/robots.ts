import type { MetadataRoute } from 'next'
import { appOrigin } from '@/lib/site'

const AI_CRAWLERS = ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'anthropic-ai', 'PerplexityBot'] as const

export default function robots(): MetadataRoute.Robots {
  const sitemap = `${appOrigin()}/sitemap.xml`
  const disallow = ['/game/', '/host/', '/history/', '/admin/']

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow,
      })),
    ],
    sitemap,
  }
}
