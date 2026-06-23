'use client'

import { useEffect, useRef } from 'react'
import { playRoundStartSound, playRoundEndSound, playVoteSubmittedSound, playGameFinishedSound } from '@/lib/sounds'
import { useToast } from '@/components/ui/Toast'
import type { Game, YahtzeeSession } from '@/types'
import { currentPlayerId } from '@/lib/yahtzee'

export function useYahtzeeNotifications({
  game,
  session,
  myPlayerId,
  enabled = true,
}: {
  game: Game | null
  session: YahtzeeSession | null
  myPlayerId: string | null | undefined
  enabled?: boolean
}) {
  const { info } = useToast()
  const readyRef = useRef(false)
  const prevTurnIndexRef = useRef<number | null>(null)
  const prevStatusRef = useRef<string | null>(null)
  const prevPhaseRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !game) return

    // Skip the very first render — we don't want to trigger sounds on mount.
    if (!readyRef.current) {
      readyRef.current = true
      prevTurnIndexRef.current = session?.current_turn_index ?? null
      prevStatusRef.current = game.status
      prevPhaseRef.current = session?.phase ?? null
      return
    }

    const prevStatus = prevStatusRef.current
    const prevTurnIndex = prevTurnIndexRef.current
    const prevPhase = prevPhaseRef.current
    const currentTurnIndex = session?.current_turn_index ?? null

    // Game just started
    if (prevStatus === 'waiting' && game.status === 'active') {
      info('Game started! 🎲')
      playRoundStartSound()
    }

    // Game just ended
    if (prevStatus === 'active' && (game.status === 'finished' || session?.phase === 'finished')) {
      playGameFinishedSound()
    }

    // Session phase flipped to finished (all scores in)
    if (prevPhase === 'rolling' && session?.phase === 'finished') {
      playGameFinishedSound()
    }

    // Turn changed
    if (
      session &&
      currentTurnIndex !== null &&
      prevTurnIndex !== null &&
      currentTurnIndex !== prevTurnIndex &&
      game.status === 'active' &&
      session.phase === 'rolling'
    ) {
      const nowMyTurn = myPlayerId && currentPlayerId(session) === myPlayerId
      if (nowMyTurn) {
        info('Your turn! 🎲 Roll the dice')
        playRoundStartSound()
      } else {
        playRoundEndSound()
      }
    }

    prevTurnIndexRef.current = currentTurnIndex
    prevStatusRef.current = game.status
    prevPhaseRef.current = session?.phase ?? null
  }, [enabled, game, info, myPlayerId, session])
}

/** Play the score-submitted chime once — call right before posting score. */
export { playVoteSubmittedSound as playYahtzeeScoreSound }
