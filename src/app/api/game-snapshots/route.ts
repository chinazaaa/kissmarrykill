import { NextRequest, NextResponse } from 'next/server'
import { internalErrorMessage } from '@/lib/api-errors'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get('gameId')?.toUpperCase()
  if (!gameId) {
    return NextResponse.json({ error: 'gameId is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('game_snapshots')
    .select('*')
    .eq('game_id', gameId)
    .order('session_number', { ascending: true })

  if (error) return NextResponse.json({ error: internalErrorMessage('game-snapshots', error) }, { status: 500 })
  return NextResponse.json({ snapshots: data ?? [] })
}
