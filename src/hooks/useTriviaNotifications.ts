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
  showCorrectAnswer,
  enabled = true,
}: {
  game: Game
  currentRound: Round | null
  screen: TriviaScreen
  correct: boolean | null | undefined
  timeLeft: number
  timeExpired: boolean
  showCorrectAnswer: boolean
  enabled?: boolean
}) {
  const readyRef = useRef(false)
  const prevRoundIdRef = useRef<string | null>(null)
  const prevGameStatusRef = useRef<Game['status'] | null>(null)
  const prevShowCorrectAnswerRef = useRef(false)
  const revealSoundRoundIdRef = useRef<string | null>(null)

  useTimerTickSound(timeLeft, enabled && screen === 'active')

  useEffect(() => {
    if (!enabled) return

    const roundId = currentRound?.id ?? null
    const prevRoundId = prevRoundIdRef.current
    const prevStatus = prevGameStatusRef.current
    const prevShowCorrectAnswer = prevShowCorrectAnswerRef.current

    if (!readyRef.current) {
      readyRef.current = true
      prevRoundIdRef.current = roundId
      prevGameStatusRef.current = game.status
      prevShowCorrectAnswerRef.current = showCorrectAnswer
      return
    }

    if (game.status === 'active' && currentRound?.status === 'active' && roundId && roundId !== prevRoundId) {
      playRoundStartSound()
      revealSoundRoundIdRef.current = null
    }

    if (showCorrectAnswer && !prevShowCorrectAnswer && roundId && revealSoundRoundIdRef.current !== roundId) {
      revealSoundRoundIdRef.current = roundId
      playRoundEndSound()
      if (correct === true) playCorrectAnswerSound()
      else if (correct === false) playWrongAnswerSound()
    }

    if (prevStatus === 'active' && game.status === 'finished') {
      playGameFinishedSound()
    }

    prevRoundIdRef.current = roundId
    prevGameStatusRef.current = game.status
    prevShowCorrectAnswerRef.current = showCorrectAnswer
  }, [correct, currentRound, enabled, game.status, showCorrectAnswer, timeExpired])
}
