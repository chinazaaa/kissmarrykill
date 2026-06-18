import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { codewordsChatSchema } from '@/lib/validation'
import { parseGameType, isCodewordsGame } from '@/lib/game-types'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(req: NextRequest) {
  const raw = await req.json()
  const parsed = codewordsChatSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { gameId, playerId, text } = parsed.data
  const code = gameId.toUpperCase()

  const { data: game } = await supabase.from('games').select('game_type, status').eq('id', code).maybeSingle()
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (!isCodewordsGame(parseGameType(game.game_type))) {
    return NextResponse.json({ error: 'Not a codewords game' }, { status: 400 })
  }
  if (game.status !== 'active') {
    return NextResponse.json({ error: 'Game is not active' }, { status: 400 })
  }

  const { data: role } = await supabase
    .from('codewords_player_roles')
    .select('team, role')
    .eq('game_id', code)
    .eq('player_id', playerId)
    .maybeSingle()
  if (!role || role.role !== 'operative') {
    return NextResponse.json({ error: 'Only operatives can chat' }, { status: 403 })
  }

  const { data: board } = await supabase.from('codewords_boards').select('winner').eq('game_id', code).maybeSingle()
  if (board?.winner) return NextResponse.json({ error: 'Game is over' }, { status: 400 })

  const { error } = await supabase.from('codewords_messages').insert({
    game_id: code,
    player_id: playerId,
    team: role.team,
    text: text.trim(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
