'use client'

import { useEffect, useMemo, useRef } from 'react'
import { revealCountdownSeconds, TRIVIA_REVEAL_SECONDS } from '@/lib/trivia'
import { useRoundTimer } from '@/hooks/useRoundTimer'
import type { Game, Player, Round, TriviaAnswer } from '@/types'

export function useTriviaHostRoundAutomation({
  game,
  rounds,
  players,
  answers,
  advancing,
  onEndRound,
  onNextRound,
  onFinishGame,
  enabled = true,
}: {
  game: Game
  rounds: Round[]
  players: Player[]
  answers: TriviaAnswer[]
  advancing: boolean
  onEndRound: () => void
  onNextRound: () => void
  onFinishGame: () => void
  enabled?: boolean
}) {
  const autoAdvancedRoundId = useRef<string | null>(null)
  const autoEndedRoundId = useRef<string | null>(null)

  const currentRound = useMemo(
    () => rounds.find((r) => r.round_number === game.current_round_number) ?? null,
    [rounds, game.current_round_number]
  )
  const activeRound = currentRound?.status === 'active' ? currentRound : null
  const lastFinishedRound = useMemo(() => {
    const finished = rounds.filter((r) => r.status === 'finished')
    return finished.length ? finished[finished.length - 1] : null
  }, [rounds])
  const betweenRounds = game.status === 'active' && !activeRound && lastFinishedRound != null
  const roundAnswers = useMemo(
    () => (currentRound ? answers.filter((a) => a.round_id === currentRound.id) : []),
    [answers, currentRound]
  )
  const isLastRound = (game.current_round_number ?? 0) >= (game.rounds_count ?? 0)
  const allAnswered = !!activeRound && players.length > 0 && roundAnswers.length >= players.length

  useRoundTimer({
    game,
    currentRound: activeRound,
    active: enabled && !!activeRound && !advancing,
    onExpire: () => {
      if (!enabled || !activeRound || advancing) return
      if (autoEndedRoundId.current === activeRound.id) return
      autoEndedRoundId.current = activeRound.id
      onEndRound()
    },
  })

  useEffect(() => {
    if (!enabled || !activeRound || advancing || players.length === 0) return
    if (roundAnswers.length < players.length) return
    if (autoEndedRoundId.current === activeRound.id) return
    autoEndedRoundId.current = activeRound.id
    onEndRound()
  }, [enabled, activeRound?.id, roundAnswers.length, players.length, advancing, onEndRound])

  useEffect(() => {
    if (!activeRound) {
      autoEndedRoundId.current = null
    }
  }, [activeRound?.id])

  useEffect(() => {
    if (!enabled || !betweenRounds) {
      autoAdvancedRoundId.current = null
      return
    }
    if (!lastFinishedRound?.ended_at || advancing) return
    if (autoAdvancedRoundId.current === lastFinishedRound.id) return

    const tryAdvance = () => {
      if (autoAdvancedRoundId.current === lastFinishedRound.id) return
      const remaining = revealCountdownSeconds(lastFinishedRound.ended_at, TRIVIA_REVEAL_SECONDS)
      if (remaining > 0) return
      autoAdvancedRoundId.current = lastFinishedRound.id
      if (isLastRound) onFinishGame()
      else onNextRound()
    }

    tryAdvance()
    const id = setInterval(tryAdvance, 100)
    return () => clearInterval(id)
  }, [
    enabled,
    betweenRounds,
    lastFinishedRound?.id,
    lastFinishedRound?.ended_at,
    isLastRound,
    advancing,
    onFinishGame,
    onNextRound,
  ])

  return { activeRound, lastFinishedRound, betweenRounds, roundAnswers, allAnswered, isLastRound }
}
