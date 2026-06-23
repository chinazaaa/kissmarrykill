'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { GameType } from '@/types'
import type { GameLandingContent } from '@/lib/game-landing'
import type { GameTypeConfig } from '@/lib/game-types'

export type GamesGridItem = {
  type: GameType
  slug: string
  content: GameLandingContent
  cfg: GameTypeConfig
}

export function GamesGrid({ games }: { games: GamesGridItem[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return games
    return games.filter(
      ({ content, cfg }) =>
        content.heroTitle.toLowerCase().includes(q) ||
        cfg.card.vibe.toLowerCase().includes(q) ||
        content.heroSubtitle.toLowerCase().includes(q)
    )
  }, [query, games])

  return (
    <div className="space-y-5">
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-faint pointer-events-none"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search games…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="input-field w-full !pl-10 py-2.5 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-faint text-sm py-8">No games match &ldquo;{query}&rdquo;</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map(({ slug, content, cfg }) => (
            <Link
              key={slug}
              href={`/games/${slug}`}
              className="glass-card glass-card-interactive p-5 space-y-3 group"
              style={{ '--accent': cfg.card.accent } as React.CSSProperties}
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
                  style={{ background: cfg.card.accentSoft }}
                >
                  {cfg.card.emoji}
                </span>
                <div className="min-w-0 space-y-1">
                  <h2 className="font-bold text-body leading-tight group-hover:text-[var(--primary)] transition-colors">
                    {content.heroTitle}
                  </h2>
                  <p className="text-faint text-xs">
                    {cfg.card.players} · {cfg.card.vibe}
                  </p>
                </div>
              </div>
              <p className="text-muted text-sm leading-relaxed line-clamp-2">{content.heroSubtitle}</p>
              <span className="text-xs font-semibold text-[var(--primary)]">Learn more →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
