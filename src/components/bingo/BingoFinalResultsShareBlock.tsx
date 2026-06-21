'use client'

import { useRef, type ReactNode } from 'react'
import type { Game, Player } from '@/types'
import { CreateNewGameButton } from '@/components/ui/CreateNewGameButton'
import { ShareResults } from '@/components/ShareResults'

export function BingoFinalResultsShareBlock({
  game,
  players,
  winnerName,
  playAgainButton,
}: {
  game: Game
  players: Player[]
  winnerName: string
  playAgainButton?: ReactNode
}) {
  const captureRef = useRef<HTMLDivElement>(null)

  return (
    <div className="space-y-4">
      <div ref={captureRef} className="glass-card-strong p-8 sm:p-10 text-center space-y-4">
        <p className="text-5xl sm:text-6xl leading-none pt-2">🏆</p>
        <p className="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-200">BINGO!</p>
        <p className="text-xl sm:text-2xl font-bold text-body">{winnerName} wins!</p>
      </div>
      <ShareResults
        captureRef={captureRef}
        game={game}
        participants={[]}
        votes={[]}
        rounds={[]}
        players={players}
        bingoWinnerName={winnerName}
      />
      {playAgainButton}
      <CreateNewGameButton />
    </div>
  )
}
