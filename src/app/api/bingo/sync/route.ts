import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { syncBingoAutoCall } from '@/lib/bingo'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const bingoSyncSchema = z.object({
  gameId: z.string().min(4).max(10),
})

export async function POST(req: NextRequest) {
  const raw = await req.json()
  const parsed = bingoSyncSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const result = await syncBingoAutoCall(supabase, parsed.data.gameId)

  if (result.code === 'game_not_found') {
    return NextResponse.json({ error: 'Game not found', code: result.code }, { status: 404 })
  }
  if (result.code === 'not_bingo') {
    return NextResponse.json({ error: 'Not a bingo game', code: result.code }, { status: 400 })
  }

  const idleCodes = new Set(['manual_mode', 'not_active', 'waiting', 'all_called'])
  const status = result.ok || idleCodes.has(result.code) ? 200 : 409
  return NextResponse.json(result, { status })
}
