import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseGameType, isScrabbleGame } from '@/lib/game-types'
import { processScrabblePlay } from '@/lib/scrabble'
import { scrabblePlaySchema } from '@/lib/validation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(req: NextRequest) {
  const raw = await req.json()
  const parsed = scrabblePlaySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { gameId, playerId, tiles } = parsed.data
  const code = gameId.toUpperCase()

  const { data: game } = await supabase.from('games').select('status, game_type').eq('id', code).maybeSingle()
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (game.status !== 'active') return NextResponse.json({ error: 'Game not active' }, { status: 400 })
  if (!isScrabbleGame(parseGameType(game.game_type))) {
    return NextResponse.json({ error: 'Not a Scrabble game' }, { status: 400 })
  }

  const { error } = await processScrabblePlay(supabase, code, playerId, tiles)
  if (error) return NextResponse.json({ error }, { status: 400 })

  return NextResponse.json({ success: true })
}
