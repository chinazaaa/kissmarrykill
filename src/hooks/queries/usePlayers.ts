import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { gameKeys } from '@/lib/query-keys'
import type { Player } from '@/types'

export function usePlayers(code: string) {
  return useQuery({
    queryKey: gameKeys.players(code),
    queryFn: async () => {
      const { data } = await supabase.from('players').select('*').eq('game_id', code).order('joined_at')
      return (data ?? []) as Player[]
    },
    staleTime: Infinity,
    enabled: !!code,
  })
}
