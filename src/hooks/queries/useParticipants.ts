import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { gameKeys } from '@/lib/query-keys'
import type { Participant } from '@/types'

export function useParticipants(code: string) {
  return useQuery({
    queryKey: gameKeys.participants(code),
    queryFn: async () => {
      const { data } = await supabase.from('participants').select('*').eq('game_id', code).order('display_order')
      return (data ?? []) as Participant[]
    },
    staleTime: Infinity,
    enabled: !!code,
  })
}
