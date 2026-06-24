import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateGameCode } from '@/lib/utils'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const name = String(body.name ?? '').trim()
  const maxMembersRaw = body.maxMembers !== undefined && body.maxMembers !== '' ? Number(body.maxMembers) : null
  const maxMembers = maxMembersRaw !== null && !isNaN(maxMembersRaw) && maxMembersRaw >= 2 ? Math.floor(maxMembersRaw) : null

  if (!name) return NextResponse.json({ error: 'Room name is required' }, { status: 400 })
  if (name.length > 50) return NextResponse.json({ error: 'Room name must be 50 characters or less' }, { status: 400 })
  if (maxMembersRaw !== null && maxMembers === null) return NextResponse.json({ error: 'Max members must be 2 or more' }, { status: 400 })

  let roomCode = generateGameCode()
  for (let i = 0; i < 10; i++) {
    const { data } = await supabase.from('rooms').select('id').eq('id', roomCode).maybeSingle()
    if (!data) break
    roomCode = generateGameCode()
  }

  const creatorToken = generateGameCode() + generateGameCode()

  const { error } = await supabase.from('rooms').insert({ id: roomCode, name, creator_token: creatorToken, max_members: maxMembers })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ roomCode, creatorToken })
}
