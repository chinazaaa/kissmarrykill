import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { gameKeys } from '@/lib/query-keys'

export function useJoinGame(gameCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/players', { gameCode, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.players(gameCode) })
    },
  })
}

export function useUpdatePlayer(gameCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch('/players', { gameCode, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.players(gameCode) })
    },
  })
}

export function useLeaveGame(gameCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (playerId: string) => api.delete('/players', { data: { gameCode, playerId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.players(gameCode) })
    },
  })
}
