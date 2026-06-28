import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { gameKeys } from '@/lib/query-keys'
import { GAME_SELECT } from '@/lib/supabase-selects'
import type { Game } from '@/types'

export function useGame(code: string) {
  return useQuery({
    queryKey: gameKeys.detail(code),
    queryFn: async () => {
      const { data } = await supabase.from('games').select(GAME_SELECT).eq('id', code).maybeSingle()
      return data as Game | null
    },
    staleTime: Infinity,
    enabled: !!code && code.length >= 4,
  })
}
