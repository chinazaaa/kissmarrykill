'use client'

import { useEffect, useMemo } from 'react'
import { useTriviaRevealAdvance } from '@/hooks/useTriviaRevealAdvance'
import type { Game, Player, Round, TriviaAnswer } from '@/types'

export function useTriviaHostRoundAutomation({
  game,
  rounds,
  players,
  answers,
  gameCode,
  onReload,
  enabled = true,
}: {
  game: Game
  rounds: Round[]
  players: Player[]
  answers: TriviaAnswer[]
  advancing?: boolean
  gameCode: string
  onReload?: () => void
  enabled?: boolean
}) {
  const currentRound = useMemo(() => {
    const byPointer = rounds.find((r) => r.round_number === game.current_round_number) ?? null
    const active = rounds.find((r) => r.status === 'active') ?? null
    if (active && byPointer && active.id !== byPointer.id && byPointer.status === 'finished') {
      return active
    }
    return byPointer
  }, [rounds, game.current_round_number])

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

  useTriviaRevealAdvance({
    gameCode,
    game,
    rounds,
    enabled: enabled && game.status === 'active',
    onAdvanced: onReload,
  })

  return { activeRound, lastFinishedRound, betweenRounds, roundAnswers, allAnswered, isLastRound }
}
