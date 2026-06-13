import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const { playerId, roundId, gameId, kiss, marry, kill } = await req.json()

  if (!playerId || !roundId || !gameId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { error } = await supabase.from('votes').upsert(
    {
      player_id: playerId,
      round_id: roundId,
      game_id: gameId,
      kiss_participant_id: kiss || null,
      marry_participant_id: marry || null,
      kill_participant_id: kill || null,
    },
    { onConflict: 'player_id,round_id' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
