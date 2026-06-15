'use client'

import { useRef, type ReactNode } from 'react'
import type { Game, Participant, Player, Round, Vote } from '@/types'
import { ShareResults } from '@/components/ShareResults'

/** Wraps final leaderboard UI so Share Results captures a snapshot of what's on screen. */
export function FinalResultsShareBlock({
  children,
  game,
  participants,
  votes,
  rounds,
  players,
}: {
  children: ReactNode
  game: Game
  participants: Participant[]
  votes: Vote[]
  rounds: Round[]
  players: Player[]
}) {
  const captureRef = useRef<HTMLDivElement>(null)

  return (
    <>
      <div ref={captureRef}>{children}</div>
      <ShareResults
        captureRef={captureRef}
        game={game}
        participants={participants}
        votes={votes}
        rounds={rounds}
        players={players}
      />
    </>
  )
}
