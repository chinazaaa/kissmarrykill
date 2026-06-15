import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ttlGuessSchema } from '@/lib/validation'
import { parseGameType, isTwoTruthsGame } from '@/lib/game-types'
import { parseTtlMetadata, TTL_GUESS_POINTS } from '@/lib/two-truths'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(req: NextRequest) {
  const raw = await req.json()
  const parsed = ttlGuessSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { gameId, playerId, roundId, guessedIndex } = parsed.data
  const code = gameId.toUpperCase()

  const { data: game } = await supabase.from('games').select('*').eq('id', code).maybeSingle()
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (!isTwoTruthsGame(parseGameType(game.game_type))) {
    return NextResponse.json({ error: 'Not a two truths game' }, { status: 400 })
  }
  if (game.status !== 'active') return NextResponse.json({ error: 'Game not active' }, { status: 400 })

  const { data: round } = await supabase.from('rounds').select('*').eq('id', roundId).eq('game_id', code).maybeSingle()
  if (!round || round.status !== 'active') {
    return NextResponse.json({ error: 'Round is not active' }, { status: 400 })
  }
  if (round.submitter_player_id === playerId) {
    return NextResponse.json({ error: 'You cannot guess on your own round' }, { status: 400 })
  }

  const metadata = parseTtlMetadata(round.ttl_metadata)
  if (!metadata) return NextResponse.json({ error: 'Invalid round data' }, { status: 400 })
  if (guessedIndex < 0 || guessedIndex > 2) {
    return NextResponse.json({ error: 'Invalid guess' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('ttl_guesses')
    .select('id')
    .eq('player_id', playerId)
    .eq('round_id', roundId)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'Already guessed this round' }, { status: 400 })

  const { data: player } = await supabase.from('players').select('id').eq('id', playerId).eq('game_id', code).maybeSingle()
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const isCorrect = guessedIndex === metadata.lie_index
  const points = isCorrect ? TTL_GUESS_POINTS : 0

  const { data: inserted, error } = await supabase
    .from('ttl_guesses')
    .insert({
      game_id: code,
      round_id: roundId,
      player_id: playerId,
      guessed_index: guessedIndex,
      is_correct: isCorrect,
      points,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    isCorrect,
    points,
    lieIndex: metadata.lie_index,
    guess: inserted,
  })
}
