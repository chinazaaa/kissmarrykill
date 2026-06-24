import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { validateWordSubmission, validWordsSetForMetadata } from '@/lib/word-hunt-dictionary'
import { parseWordHuntMetadata, wordHuntPoints, wordHuntSessionExpired } from '@/lib/word-hunt'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const submitSchema = z.object({
  gameId: z.string().min(1).max(10).toUpperCase(),
  playerId: z.string().uuid(),
  word: z.string().min(3).max(16),
  path: z.array(z.number().int().min(0).max(15)).min(3).max(16),
})

export async function POST(req: NextRequest) {
  const raw = await req.json()
  const parsed = submitSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { gameId, playerId, word, path } = parsed.data

  const { data: game } = await supabase
    .from('games')
    .select('id,status,session_started_at,timer_seconds')
    .eq('id', gameId)
    .maybeSingle()

  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (game.status !== 'active') {
    return NextResponse.json({ error: 'Game is not active' }, { status: 400 })
  }

  if (wordHuntSessionExpired(game.session_started_at, game.timer_seconds)) {
    return NextResponse.json({ error: 'Time is up' }, { status: 400 })
  }

  const { data: round } = await supabase
    .from('rounds')
    .select('id,word_hunt_metadata')
    .eq('game_id', gameId)
    .eq('round_number', 1)
    .maybeSingle()

  if (!round) return NextResponse.json({ error: 'Round not found' }, { status: 404 })

  const metadata = parseWordHuntMetadata(round.word_hunt_metadata)
  if (!metadata) return NextResponse.json({ error: 'Grid data missing' }, { status: 500 })

  const validWords = validWordsSetForMetadata(metadata)
  const validation = validateWordSubmission(metadata.grid, word, path, validWords)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { data: alreadyFound } = await supabase
    .from('word_hunt_submissions')
    .select('id')
    .eq('round_id', round.id)
    .eq('player_id', playerId)
    .eq('word', validation.normalized)
    .maybeSingle()

  if (alreadyFound) {
    return NextResponse.json({ error: 'You already found this word' }, { status: 409 })
  }

  const pointsAwarded = wordHuntPoints(validation.normalized.length)

  const { error: insertError } = await supabase.from('word_hunt_submissions').insert({
    game_id: gameId,
    round_id: round.id,
    player_id: playerId,
    word: validation.normalized,
    path,
    points_awarded: pointsAwarded,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'You already found this word' }, { status: 409 })
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, pointsAwarded, word: validation.normalized })
}
