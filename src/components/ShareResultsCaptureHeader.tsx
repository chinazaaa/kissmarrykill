'use client'

import { gameTypeConfig, parseGameType } from '@/lib/game-types'
import type { Game } from '@/types'

export function ShareResultsCaptureHeader({
  game,
  className = '',
}: {
  game: Pick<Game, 'title' | 'game_type'>
  className?: string
}) {
  const cfg = gameTypeConfig(parseGameType(game.game_type))

  return (
    <div className={`text-center space-y-1 pb-3 border-b border-[color-mix(in_srgb,var(--primary)_10%,var(--border))] ${className}`}>
      <p className="text-2xl sm:text-3xl leading-none">{cfg.headerEmoji}</p>
      <p className="text-lg sm:text-xl font-black gradient-title leading-tight">{game.title}</p>
      <p className="text-muted text-[10px] sm:text-xs uppercase tracking-wider">{cfg.label}</p>
    </div>
  )
}
