import { NextRequest, NextResponse } from 'next/server'
import { internalErrorMessage } from '@/lib/api-errors'
import { assertManagerRequest } from '@/lib/manager-api'
import { searchPlayers } from '@/lib/community-data'

export async function GET(req: NextRequest) {
  const session = await assertManagerRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q') ?? ''
  try {
    const names = await searchPlayers(q)
    return NextResponse.json({ players: names })
  } catch (err) {
    return NextResponse.json({ error: internalErrorMessage('manager/players', err, 'Failed') }, { status: 500 })
  }
}
