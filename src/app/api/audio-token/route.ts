import { NextRequest, NextResponse } from 'next/server'
import { internalErrorMessage } from '@/lib/api-errors'
import { AccessToken } from 'livekit-server-sdk'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

type AudioAuth = { kind: 'player' } | { kind: 'member' } | { kind: 'host'; token?: string }

/**
 * Verify the caller is genuinely associated with the room they're requesting a
 * token for, using trusted server-side state. `identity` is the caller's
 * server-generated secret id (player/member UUID); the host proves itself with
 * the game's host_token. Returns true only when the membership/credential
 * matches the requested room.
 */
async function isAuthorized(roomName: string, identity: string, auth: AudioAuth | undefined): Promise<boolean> {
  if (!auth) return false
  const supabase = getSupabaseAdmin()

  if (auth.kind === 'player') {
    const { data } = await supabase
      .from('players')
      .select('id')
      .eq('id', identity)
      .eq('game_id', roomName)
      .maybeSingle()
    return Boolean(data)
  }

  if (auth.kind === 'member') {
    const { data } = await supabase.from('room_members').select('id, room_id').eq('id', identity).maybeSingle()
    return Boolean(data && data.room_id?.toUpperCase() === roomName.toUpperCase())
  }

  if (auth.kind === 'host') {
    if (!auth.token) return false
    const { data } = await supabase.from('games').select('host_token').eq('id', roomName).maybeSingle()
    return Boolean(data?.host_token && data.host_token === auth.token)
  }

  return false
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { roomName, identity, name, auth } = body as {
      roomName?: string
      identity?: string
      name?: string
      auth?: AudioAuth
    }

    if (!roomName || !identity) {
      return NextResponse.json({ error: 'roomName and identity are required' }, { status: 400 })
    }

    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set in environment variables' },
        { status: 500 }
      )
    }

    const authorized = await isAuthorized(roomName, identity, auth)
    if (!authorized) {
      return NextResponse.json({ error: 'Not authorized to join this voice room' }, { status: 403 })
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: name || identity,
    })
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true })
    const token = await at.toJwt()
    return NextResponse.json({ token })
  } catch (err) {
    const message = internalErrorMessage('audio-token', err, 'Failed to generate token')
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
