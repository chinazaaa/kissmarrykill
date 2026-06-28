import { NextRequest, NextResponse } from 'next/server'
import { createConfessionSchema } from '@/lib/validation'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { assertPlayer } from '@/lib/game-admin'

export async function POST(req: NextRequest) {
  const raw = await req.json()
  const parsed = createConfessionSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { gameId, roundId, text, resumeToken } = parsed.data

  const supabase = getSupabaseAdmin()

  // Authorize by the secret resume_token: confessions stay anonymous to other players,
  // but the poster must be a real player in this game. The resolved player id is NOT
  // persisted on the confession.
  const auth = await assertPlayer(supabase, gameId, resumeToken)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await supabase.from('confessions').insert({
    game_id: gameId,
    round_id: roundId || null,
    text,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
