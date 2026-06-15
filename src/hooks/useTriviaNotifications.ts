'use client'

import { useEffect, useRef } from 'react'
import {
  playCorrectAnswerSound,
  playGameFinishedSound,
  playRoundEndSound,
  playRoundStartSound,
  playWrongAnswerSound,
} from '@/lib/sounds'
import { useTimerTickSound } from '@/hooks/useTimerTickSound'
import type { Game, Round } from '@/types'

type TriviaScreen = 'waiting' | 'active' | 'locked' | 'revealed' | 'finished'

export function useTriviaNotifications({
  game,
  currentRound,
  screen,
  correct,
  timeLeft,
  timeExpired,
  enabled = true,
}: {
  game: Game
  currentRound: Round | null
  screen: TriviaScreen
  correct: boolean | null | undefined
  timeLeft: number
  timeExpired: boolean
  enabled?: boolean
}) {
  const readyRef = useRef(false)
  const prevRoundIdRef = useRef<string | null>(null)
  const prevScreenRef = useRef<TriviaScreen | null>(null)
  const prevGameStatusRef = useRef<Game['status'] | null>(null)
  const prevTimeExpiredRef = useRef(false)
  const revealedSoundRoundIdRef = useRef<string | null>(null)

  useTimerTickSound(timeLeft, enabled && screen === 'active')

  useEffect(() => {
    if (!enabled) return

    const roundId = currentRound?.id ?? null
    const prevRoundId = prevRoundIdRef.current
    const prevScreen = prevScreenRef.current
    const prevStatus = prevGameStatusRef.current

    if (!readyRef.current) {
      readyRef.current = true
      prevRoundIdRef.current = roundId
      prevScreenRef.current = screen
      prevGameStatusRef.current = game.status
      prevTimeExpiredRef.current = timeExpired
      if (roundId && currentRound?.status === 'active') {
        revealedSoundRoundIdRef.current = null
      }
      return
    }

    if (game.status === 'active' && currentRound?.status === 'active' && roundId && roundId !== prevRoundId) {
      playRoundStartSound()
      revealedSoundRoundIdRef.current = null
    }

    if (timeExpired && !prevTimeExpiredRef.current && (prevScreen === 'active' || screen === 'locked')) {
      playRoundEndSound()
    }

    if (
      screen === 'revealed' &&
      prevScreen === 'locked' &&
      roundId &&
      revealedSoundRoundIdRef.current !== roundId
    ) {
      revealedSoundRoundIdRef.current = roundId
      playRoundEndSound()
      if (correct === true) playCorrectAnswerSound()
      else if (correct === false) playWrongAnswerSound()
    }

    if (prevStatus === 'active' && game.status === 'finished') {
      playGameFinishedSound()
    }

    prevRoundIdRef.current = roundId
    prevScreenRef.current = screen
    prevGameStatusRef.current = game.status
    prevTimeExpiredRef.current = timeExpired
  }, [correct, currentRound, enabled, game.status, screen, timeExpired])
}
