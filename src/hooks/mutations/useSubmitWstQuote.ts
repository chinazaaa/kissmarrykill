import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { gameKeys } from '@/lib/query-keys'

export function useSubmitWstQuote(gameCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/wst-quotes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.wstPool(gameCode) })
    },
  })
}
