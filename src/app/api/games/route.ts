import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateGameCode, generateToken } from '@/lib/utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, rounds_count, timer_seconds, anonymous, auto_reveal, auto_submit_behavior, participants } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Game name is required' }, { status: 400 })
  }
  if (!Array.isArray(participants) || participants.length < 3) {
    return NextResponse.json({ error: 'At least 3 participants required' }, { status: 400 })
  }

  // Generate a unique code
  let gameCode = generateGameCode()
  for (let i = 0; i < 10; i++) {
    const { data } = await supabase.from('games').select('id').eq('id', gameCode).maybeSingle()
    if (!data) break
    gameCode = generateGameCode()
  }

  const hostToken = generateToken()

  const { error: gameError } = await supabase.from('games').insert({
    id: gameCode,
    title: title.trim(),
    host_token: hostToken,
    rounds_count: Math.min(Math.max(Number(rounds_count) || 3, 1), 20),
    timer_seconds: [15, 30, 60].includes(Number(timer_seconds)) ? Number(timer_seconds) : 30,
    anonymous: Boolean(anonymous),
    auto_reveal: Boolean(auto_reveal),
    auto_submit_behavior: auto_submit_behavior === 'no_answer' ? 'no_answer' : 'random',
    status: 'waiting',
    current_round_number: 0,
  })

  if (gameError) {
    return NextResponse.json({ error: gameError.message }, { status: 500 })
  }

  const participantRows = (participants as string[]).map((name, index) => ({
    game_id: gameCode,
    name: name.trim(),
    display_order: index,
  }))

  const { error: partError } = await supabase.from('participants').insert(participantRows)
  if (partError) {
    await supabase.from('games').delete().eq('id', gameCode)
    return NextResponse.json({ error: partError.message }, { status: 500 })
  }

  return NextResponse.json({ gameCode, hostToken })
}
