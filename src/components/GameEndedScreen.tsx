'use client'

import { GameTypeBadge } from '@/components/GameTypeBadge'
import { CreateNewGameButton } from '@/components/ui/CreateNewGameButton'
import { useApplyGameTheme } from '@/hooks/useApplyGameTheme'
import { gameTypeConfig, parseGameType } from '@/lib/game-types'
import type { Game, GameType } from '@/types'

type Props = {
  game: Pick<Game, 'title' | 'game_type'> | null
}

export function GameEndedScreen({ game }: Props) {
  useApplyGameTheme('default')

  const gameType = parseGameType(game?.game_type ?? 'smash_marry_kill')
  const cfg = gameTypeConfig(gameType)

  return (
    <div className="page-wrap flex items-center justify-center px-4">
      <div className="glass-card p-6 w-full max-w-md space-y-5 text-center">
        <div className="space-y-2">
          <div className="text-4xl">{cfg.headerEmoji}</div>
          <h1 className="text-2xl font-black text-body">{game?.title ?? 'This game'}</h1>
          <GameTypeBadge gameType={gameType as GameType} />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-bold text-body">This game has ended</p>
          <p className="text-muted text-sm leading-relaxed">
            This link is no longer active. Start a new game to play again with friends.
          </p>
        </div>
        <CreateNewGameButton />
      </div>
    </div>
  )
}
