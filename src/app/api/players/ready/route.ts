import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const schema = z.object({
  gameId: z.string().min(2).max(12),
  playerId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  const raw = await req.json()
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { gameId, playerId } = parsed.data
  const gameCode = gameId.toUpperCase()

  const { data: game } = await supabase.from('games').select('id, status').eq('id', gameCode).maybeSingle()

  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (game.status !== 'waiting') {
    return NextResponse.json({ error: 'Game is not in the lobby' }, { status: 400 })
  }

  const { error } = await supabase
    .from('players')
    .update({ spectator: false })
    .eq('id', playerId)
    .eq('game_id', gameCode)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
