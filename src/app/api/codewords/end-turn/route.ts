import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { codewordsEndTurnSchema } from '@/lib/validation'
import { parseGameType, isCodewordsGame } from '@/lib/game-types'
import { otherTeam } from '@/lib/codewords'
import type { CodewordsBoard } from '@/types'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(req: NextRequest) {
  const raw = await req.json()
  const parsed = codewordsEndTurnSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { gameId, playerId } = parsed.data
  const code = gameId.toUpperCase()

  const { data: game } = await supabase.from('games').select('game_type, status').eq('id', code).maybeSingle()
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (!isCodewordsGame(parseGameType(game.game_type))) {
    return NextResponse.json({ error: 'Not a codewords game' }, { status: 400 })
  }
  if (game.status !== 'active') return NextResponse.json({ error: 'Game not active' }, { status: 400 })

  const { data: role } = await supabase
    .from('codewords_player_roles')
    .select('team, role')
    .eq('game_id', code)
    .eq('player_id', playerId)
    .maybeSingle()
  if (!role || role.role !== 'operative') {
    return NextResponse.json({ error: 'Only operatives can end the turn' }, { status: 403 })
  }

  const { data: board } = await supabase.from('codewords_boards').select('*').eq('game_id', code).maybeSingle()
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  const typedBoard = board as CodewordsBoard
  if (typedBoard.winner) return NextResponse.json({ error: 'Game is over' }, { status: 400 })
  if (typedBoard.current_turn !== role.team) {
    return NextResponse.json({ error: 'Not your team\'s turn' }, { status: 400 })
  }
  if (!typedBoard.current_clue_word) {
    return NextResponse.json({ error: 'No active clue to end' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('codewords_boards')
    .update({
      current_turn: otherTeam(role.team),
      guesses_remaining: null,
      current_clue_word: null,
      current_clue_number: null,
    })
    .eq('id', typedBoard.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, board: updated })
}
