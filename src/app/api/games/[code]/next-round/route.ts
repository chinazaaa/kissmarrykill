import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { hostToken } = await req.json()

  const { data: game } = await supabase.from('games').select('*').eq('id', code.toUpperCase()).maybeSingle()
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (game.host_token !== hostToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (game.status !== 'active') return NextResponse.json({ error: 'Game not active' }, { status: 400 })

  const now = new Date().toISOString()

  // End current round
  await supabase
    .from('rounds')
    .update({ status: 'finished', ended_at: now })
    .eq('game_id', code.toUpperCase())
    .eq('round_number', game.current_round_number)

  const nextRoundNumber = game.current_round_number + 1

  if (nextRoundNumber > game.rounds_count) {
    await supabase.from('games').update({ status: 'finished' }).eq('id', code.toUpperCase())
    return NextResponse.json({ finished: true })
  }

  // Activate next round
  await supabase
    .from('rounds')
    .update({ status: 'active', started_at: now })
    .eq('game_id', code.toUpperCase())
    .eq('round_number', nextRoundNumber)

  await supabase
    .from('games')
    .update({ current_round_number: nextRoundNumber })
    .eq('id', code.toUpperCase())

  return NextResponse.json({ success: true, nextRound: nextRoundNumber })
}
