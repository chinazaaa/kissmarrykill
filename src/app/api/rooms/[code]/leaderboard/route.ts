import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const roomCode = code.toUpperCase()

  const { data: members, error } = await supabase
    .from('room_members')
    .select('id, display_name, times_kissed, times_married, times_killed, games_played')
    .eq('room_id', roomCode)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const leaderboard = (members ?? [])
    .map((m) => ({
      ...m,
      total: m.times_kissed + m.times_married + m.times_killed,
    }))
    .sort((a, b) => b.total - a.total || b.games_played - a.games_played)

  return NextResponse.json({ leaderboard })
}
