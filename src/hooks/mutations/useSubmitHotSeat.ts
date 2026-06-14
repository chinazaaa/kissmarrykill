import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { gameKeys } from '@/lib/query-keys'

export function useSubmitHotSeat(gameCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { gameId: string; roundId: string; playerId: string; text: string; submissionType: string }) =>
      api.post('/hot-seat', data),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: gameKeys.hotSeat(gameCode, variables.roundId) })
    },
  })
}
