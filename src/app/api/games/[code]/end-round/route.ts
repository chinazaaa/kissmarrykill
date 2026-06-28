import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hostActionSchema } from '@/lib/validation'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const raw = await req.json()
  const parsed = hostActionSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { hostToken } = parsed.data
  const gameId = code.toUpperCase()

  const admin = getSupabaseAdmin()

  const { data: game } = await admin.from('games').select('*').eq('id', gameId).maybeSingle()
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (game.host_token !== hostToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (game.status !== 'active') return NextResponse.json({ error: 'Game not active' }, { status: 400 })

  const { data: activeRound } = await admin
    .from('rounds')
    .select('*')
    .eq('game_id', gameId)
    .eq('status', 'active')
    .maybeSingle()

  if (!activeRound) {
    const { data: pointerRound } = await admin
      .from('rounds')
      .select('round_number, status')
      .eq('game_id', gameId)
      .eq('round_number', game.current_round_number)
      .maybeSingle()

    if (pointerRound?.status === 'finished') {
      return NextResponse.json({
        finished: true,
        alreadyEnded: true,
        isLastRound: pointerRound.round_number >= game.rounds_count,
        roundNumber: pointerRound.round_number,
      })
    }

    return NextResponse.json({ error: 'No active round to end' }, { status: 400 })
  }

  const now = new Date().toISOString()

  const { error: endRoundError } = await admin
    .from('rounds')
    .update({ status: 'finished', ended_at: now })
    .eq('id', activeRound.id)

  if (endRoundError) return NextResponse.json({ error: endRoundError.message }, { status: 500 })

  const isLastRound = activeRound.round_number >= game.rounds_count
  return NextResponse.json({
    finished: true,
    isLastRound,
    roundNumber: activeRound.round_number,
  })
}
