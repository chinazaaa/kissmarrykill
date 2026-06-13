import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { assertHostGame } from '@/lib/game-admin'
import { questionPoolCap } from '@/lib/custom-questions'
import { updateGameSchema } from '@/lib/validation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const raw = await req.json()
  const parsed = updateGameSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { hostToken, rounds_count: rawRoundsCount, participant_filter } = parsed.data

  const auth = await assertHostGame(supabase, code, hostToken)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const updatePayload: Record<string, unknown> = {}

  if (rawRoundsCount !== undefined) {
    const cap = questionPoolCap(auth.game!)
    const rounds_count = Math.min(Math.max(rawRoundsCount, 1), cap)
    if (rawRoundsCount > cap) {
      return NextResponse.json({ error: `Too many rounds — pick ${cap} or fewer` }, { status: 400 })
    }
    updatePayload.rounds_count = rounds_count
  }

  if (participant_filter !== undefined) {
    updatePayload.participant_filter = participant_filter === 'joined' ? 'joined' : 'all'
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data: game, error } = await supabase
    .from('games')
    .update(updatePayload)
    .eq('id', auth.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ game })
}
