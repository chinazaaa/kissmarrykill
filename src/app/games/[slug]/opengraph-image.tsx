import { ImageResponse } from 'next/og'
import { notFound } from 'next/navigation'
import { getGameLandingContent } from '@/lib/game-landing'
import { gameTypeConfig } from '@/lib/game-types'
import { SITE_NAME } from '@/lib/seo'

export const runtime = 'edge'
export const alt = 'Fate Round party game'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type Props = { params: Promise<{ slug: string }> }

export default async function Image({ params }: Props) {
  const { slug } = await params
  const content = getGameLandingContent(slug)
  if (!content) notFound()

  const cfg = gameTypeConfig(content.gameType)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: `linear-gradient(145deg, #0f0f14 0%, #1a1020 55%, ${cfg.card.accent}22 100%)`,
          color: '#f8fafc',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              background: cfg.card.accentSoft,
            }}
          >
            {cfg.card.emoji}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 24, opacity: 0.75 }}>{SITE_NAME}</div>
            <div style={{ fontSize: 34, fontWeight: 800 }}>{cfg.label}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
          <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1.05, letterSpacing: -2 }}>
            {content.heroTitle}
          </div>
          <div style={{ fontSize: 28, lineHeight: 1.4, opacity: 0.82 }}>{content.heroSubtitle}</div>
        </div>

        <div style={{ display: 'flex', gap: 16, fontSize: 22, opacity: 0.7 }}>
          <span>Free forever</span>
          <span>·</span>
          <span>No sign-up</span>
          <span>·</span>
          <span>{cfg.card.players}</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
