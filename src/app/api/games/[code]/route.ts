import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { assertHostGame } from '@/lib/game-admin'
import { questionPoolCap } from '@/lib/custom-questions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { hostToken, rounds_count: rawRoundsCount } = await req.json()

  if (!hostToken) {
    return NextResponse.json({ error: 'hostToken is required' }, { status: 400 })
  }

  const auth = await assertHostGame(supabase, code, hostToken)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (rawRoundsCount === undefined) {
    return NextResponse.json({ error: 'rounds_count is required' }, { status: 400 })
  }

  const cap = questionPoolCap(auth.game!)
  const rounds_count = Math.min(Math.max(Number(rawRoundsCount) || 1, 1), cap)

  if (Number(rawRoundsCount) > cap) {
    return NextResponse.json(
      { error: `Too many rounds — pick ${cap} or fewer` },
      { status: 400 }
    )
  }

  const { data: game, error } = await supabase
    .from('games')
    .update({ rounds_count })
    .eq('id', auth.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ game })
}
