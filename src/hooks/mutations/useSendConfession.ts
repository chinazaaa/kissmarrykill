import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { gameKeys } from '@/lib/query-keys'

export function useSendConfession(gameCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { gameId: string; roundId?: string; text: string }) => api.post('/confessions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.confessions.all(gameCode) })
    },
  })
}
