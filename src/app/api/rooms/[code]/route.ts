import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const roomCode = code.toUpperCase()
  const body = await req.json()
  const creatorToken = String(body.creatorToken ?? '')

  if (!creatorToken) return NextResponse.json({ error: 'Creator token required' }, { status: 401 })

  const { data: room } = await supabase.from('rooms').select('creator_token').eq('id', roomCode).maybeSingle()
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  if (!room.creator_token || room.creator_token !== creatorToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { error } = await supabase.from('rooms').delete().eq('id', roomCode)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const roomCode = code.toUpperCase()

  const { data: room } = await supabase.from('rooms').select('id, name, created_at').eq('id', roomCode).maybeSingle()
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  const [{ data: members }, { data: recentGames }] = await Promise.all([
    supabase
      .from('room_members')
      .select('id, display_name, member_code, joined_at, times_kissed, times_married, times_killed, games_played, room_points')
      .eq('room_id', roomCode)
      .order('joined_at', { ascending: true }),
    supabase
      .from('room_games')
      .select('id, game_id, created_at, started_by_member_id, room_members(display_name), games(title, game_type, status)')
      .eq('room_id', roomCode)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return NextResponse.json({ room, members: members ?? [], recentGames: recentGames ?? [] })
}
