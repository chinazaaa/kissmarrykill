'use client'

import { gameTypeConfig, parseGameType } from '@/lib/game-types'
import type { Game, GameStatus } from '@/types'

type Props = {
  game: Pick<Game, 'title' | 'status' | 'game_type'>
  subtitle?: string
  className?: string
}

function hostSubtitle(gameLabel: string, status: GameStatus): string {
  if (status === 'finished') return `${gameLabel} · Final results`
  return `${gameLabel} · Host panel`
}

export function HostGameHeader({ game, subtitle, className = '' }: Props) {
  const cfg = gameTypeConfig(parseGameType(game.game_type))
  const line = subtitle ?? hostSubtitle(cfg.label, game.status)

  return (
    <div className={`text-center space-y-1 ${className}`}>
      <div className="text-4xl sm:text-5xl">{cfg.headerEmoji}</div>
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight gradient-title">{game.title}</h1>
      <p className="text-muted text-sm">{line}</p>
    </div>
  )
}
