import { NextRequest, NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { roomName, identity, name } = body as {
      roomName?: string
      identity?: string
      name?: string
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

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: name || identity,
    })
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true })
    const token = await at.toJwt()
    return NextResponse.json({ token })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate token'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
