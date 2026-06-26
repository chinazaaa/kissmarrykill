import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseGameType, isScrabbleGame } from '@/lib/game-types'
import { finishExpiredScrabbleGame, scrabbleGameSessionExpired } from '@/lib/scrabble'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const gameId = code.toUpperCase()

  const { data: game } = await supabase
    .from('games')
    .select('id, status, game_type, session_started_at, game_duration_seconds')
    .eq('id', gameId)
    .maybeSingle()

  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (!isScrabbleGame(parseGameType(game.game_type))) {
    return NextResponse.json({ error: 'Not a Scrabble game' }, { status: 400 })
  }
  if (game.status !== 'active') {
    return NextResponse.json({ expired: false, finished: game.status === 'finished' })
  }
  if (!scrabbleGameSessionExpired(game.session_started_at, game.game_duration_seconds)) {
    return NextResponse.json({ expired: false, finished: false })
  }

  const finished = await finishExpiredScrabbleGame(supabase, game)
  if (!finished) return NextResponse.json({ error: 'Failed to end game' }, { status: 500 })

  return NextResponse.json({ expired: true, finished: true })
}
