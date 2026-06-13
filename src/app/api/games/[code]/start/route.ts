import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateRoundsByGender } from '@/lib/utils'

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
  if (game.status !== 'waiting') return NextResponse.json({ error: 'Game already started' }, { status: 400 })

  const { data: participantsData } = await supabase
    .from('participants')
    .select('id, gender')
    .eq('game_id', code.toUpperCase())
    .order('display_order')

  if (!participantsData || participantsData.length < 3) {
    return NextResponse.json({ error: 'Need at least 3 participants' }, { status: 400 })
  }

  const participants = participantsData.map((p) => ({
    id: p.id,
    gender: p.gender === 'male' ? 'male' as const : 'female' as const,
  }))

  const trios = generateRoundsByGender(participants, game.rounds_count)
  if (trios.length === 0) {
    return NextResponse.json(
      { error: 'Need at least 3 people of the same gender to start' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()

  const roundRows = trios.map((trio, index) => ({
    game_id: code.toUpperCase(),
    round_number: index + 1,
    participant_ids: trio,
    status: index === 0 ? 'active' : 'pending',
    started_at: index === 0 ? now : null,
    ended_at: null,
  }))

  const { error: roundError } = await supabase.from('rounds').insert(roundRows)
  if (roundError) return NextResponse.json({ error: roundError.message }, { status: 500 })

  const { error: gameError } = await supabase
    .from('games')
    .update({ status: 'active', current_round_number: 1 })
    .eq('id', code.toUpperCase())

  if (gameError) return NextResponse.json({ error: gameError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
