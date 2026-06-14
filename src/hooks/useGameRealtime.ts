'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { gameKeys } from '@/lib/query-keys'
import type { Game, Round } from '@/types'

/**
 * Subscribes to Supabase Realtime for a game and invalidates
 * React Query cache on each event. This runs alongside the
 * existing setState-based handlers during migration.
 */
export function useGameRealtime(gameCode: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!gameCode) return

    const ch = supabase
      .channel(`rq-${gameCode}`)

      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameCode}` },
        (payload) => {
          const newGame = payload.new as Game
          queryClient.setQueryData(gameKeys.detail(gameCode), newGame)
          if (newGame.status === 'active') {
            queryClient.invalidateQueries({ queryKey: gameKeys.rounds.active(gameCode) })
            queryClient.invalidateQueries({ queryKey: gameKeys.participants(gameCode) })
          }
          if (newGame.status === 'finished') {
            queryClient.invalidateQueries({ queryKey: gameKeys.allResults(gameCode) })
          }
        }
      )

      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rounds', filter: `game_id=eq.${gameCode}` },
        (payload) => {
          const round = payload.new as Round
          if (round.status === 'active') {
            queryClient.setQueryData(gameKeys.rounds.active(gameCode), round)
          }
          if (round.status === 'finished') {
            queryClient.setQueryData(gameKeys.rounds.active(gameCode), null)
            queryClient.invalidateQueries({ queryKey: gameKeys.votes.byRound(gameCode, round.id) })
            queryClient.invalidateQueries({ queryKey: gameKeys.confessions.all(gameCode) })
            queryClient.invalidateQueries({ queryKey: gameKeys.hotSeat(gameCode, round.id) })
          }
        }
      )

      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameCode}` },
        () => {
          queryClient.invalidateQueries({ queryKey: gameKeys.players(gameCode) })
        }
      )

      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `game_id=eq.${gameCode}` },
        () => {
          queryClient.invalidateQueries({ queryKey: gameKeys.participants(gameCode) })
        }
      )

      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes', filter: `game_id=eq.${gameCode}` },
        (payload) => {
          const vote = payload.new as { round_id: string }
          if (vote?.round_id) {
            queryClient.invalidateQueries({ queryKey: gameKeys.votes.byRound(gameCode, vote.round_id) })
          }
          queryClient.invalidateQueries({ queryKey: gameKeys.votes.all(gameCode) })
        }
      )

      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wst_quote_pool', filter: `game_id=eq.${gameCode}` },
        () => {
          queryClient.invalidateQueries({ queryKey: gameKeys.wstPool(gameCode) })
        }
      )

      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'confessions', filter: `game_id=eq.${gameCode}` },
        () => {
          queryClient.invalidateQueries({ queryKey: gameKeys.confessions.all(gameCode) })
        }
      )

      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_questions', filter: `game_id=eq.${gameCode}` },
        () => {
          queryClient.invalidateQueries({ queryKey: gameKeys.playerQuestions(gameCode) })
        }
      )

      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [gameCode, queryClient])
}
