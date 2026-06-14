import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { gameKeys } from '@/lib/query-keys'

export function useStartGame(gameCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (hostToken: string) => api.post(`/games/${gameCode}/start`, { hostToken }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameCode) })
      queryClient.invalidateQueries({ queryKey: gameKeys.rounds.active(gameCode) })
    },
  })
}

export function useEndRound(gameCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (hostToken: string) => api.post(`/games/${gameCode}/end-round`, { hostToken }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.rounds.active(gameCode) })
      queryClient.invalidateQueries({ queryKey: gameKeys.rounds.finished(gameCode) })
    },
  })
}

export function useNextRound(gameCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (hostToken: string) => api.post(`/games/${gameCode}/next-round`, { hostToken }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.rounds.active(gameCode) })
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameCode) })
    },
  })
}

export function useFinishGame(gameCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (hostToken: string) => api.post(`/games/${gameCode}/finish-game`, { hostToken }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameCode) })
      queryClient.invalidateQueries({ queryKey: gameKeys.allResults(gameCode) })
    },
  })
}

export function usePlayAgain(gameCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (hostToken: string) => api.post(`/games/${gameCode}/play-again`, { hostToken }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games', gameCode] })
    },
  })
}

export function useUpdateRoundsCount(gameCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { hostToken: string; rounds_count: number }) => api.patch(`/games/${gameCode}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameCode) })
    },
  })
}
