import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { assertHostGame } from '@/lib/game-admin'

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

  const rounds_count = Math.min(Math.max(Number(rawRoundsCount) || 1, 1), 20)

  const { data: game, error } = await supabase
    .from('games')
    .update({ rounds_count })
    .eq('id', auth.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ game })
}
