import { NextRequest, NextResponse } from 'next/server'
import { internalErrorMessage } from '@/lib/api-errors'
import { assertManagerRequest } from '@/lib/manager-api'
import { addResult, deleteResult, getDayWinners } from '@/lib/community-data'
import { isValidDateStr, watToday } from '@/lib/community-dates'

// GET ?date=YYYY-MM-DD — the day's games with their recorded winners (defaults to today, WAT).
export async function GET(req: NextRequest) {
  const session = await assertManagerRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dateParam = req.nextUrl.searchParams.get('date')
  const date = isValidDateStr(dateParam) ? dateParam : watToday()
  try {
    const games = await getDayWinners(date)
    return NextResponse.json({ date, games })
  } catch (err) {
    return NextResponse.json({ error: internalErrorMessage('manager/results', err, 'Failed') }, { status: 500 })
  }
}

// POST { gameId, date, playerName } — add a winner for one game on one day.
// Games can have multiple winners; re-adding the same name is a no-op.
export async function POST(req: NextRequest) {
  const session = await assertManagerRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const gameId = typeof body.gameId === 'string' ? body.gameId : ''
  const date = typeof body.date === 'string' ? body.date : ''
  const playerName = typeof body.playerName === 'string' ? body.playerName.trim() : ''

  if (!gameId) return NextResponse.json({ error: 'gameId is required' }, { status: 400 })
  if (!isValidDateStr(date)) return NextResponse.json({ error: 'A valid date is required' }, { status: 400 })
  if (!playerName) return NextResponse.json({ error: 'Winner name is required' }, { status: 400 })

  try {
    await addResult(gameId, date, playerName)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: internalErrorMessage('manager/results', err, 'Failed to save') }, { status: 500 })
  }
}

// DELETE ?gameId=&date=&playerName= — remove one winner from a game/day. Omit
// playerName to clear every winner recorded for that game on that day.
export async function DELETE(req: NextRequest) {
  const session = await assertManagerRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gameId = req.nextUrl.searchParams.get('gameId') ?? ''
  const date = req.nextUrl.searchParams.get('date') ?? ''
  const playerName = req.nextUrl.searchParams.get('playerName') ?? ''
  if (!gameId) return NextResponse.json({ error: 'gameId is required' }, { status: 400 })
  if (!isValidDateStr(date)) return NextResponse.json({ error: 'A valid date is required' }, { status: 400 })

  try {
    await deleteResult(gameId, date, playerName)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: internalErrorMessage('manager/results', err, 'Failed to clear') },
      { status: 500 }
    )
  }
}
