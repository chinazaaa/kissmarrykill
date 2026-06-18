import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { parseGameType } from '@/lib/game-types'
import type { GameType } from '@/types'

/** Server-only: resolve a room code to its game type for metadata and SSR. */
export async function fetchGameTypeByCode(code: string): Promise<GameType | null> {
  const gameCode = code.trim().toUpperCase()
  if (gameCode.length < 4) return null

  const { data } = await getSupabaseAdmin()
    .from('games')
    .select('game_type')
    .eq('id', gameCode)
    .maybeSingle()

  return data?.game_type ? parseGameType(data.game_type) : null
}
