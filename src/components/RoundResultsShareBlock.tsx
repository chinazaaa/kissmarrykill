'use client'

import { useRef, type ReactNode } from 'react'
import type { Game, Participant, Player, Round, Vote } from '@/types'
import { ShareRoundResults } from '@/components/ShareRoundResults'

/** Wraps round results UI so Share Round captures a snapshot of what's on screen. */
export function RoundResultsShareBlock({
  children,
  game,
  round,
  votes,
  participants,
  players,
}: {
  children: ReactNode
  game: Game
  round: Round
  votes: Vote[]
  participants: Participant[]
  players: Player[]
}) {
  const captureRef = useRef<HTMLDivElement>(null)

  return (
    <>
      <div ref={captureRef}>{children}</div>
      <ShareRoundResults
        captureRef={captureRef}
        game={game}
        round={round}
        votes={votes}
        participants={participants}
        players={players}
      />
    </>
  )
}
