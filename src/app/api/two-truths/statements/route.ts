import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ttlStatementSchema } from '@/lib/validation'
import { parseGameType, isTwoTruthsGame } from '@/lib/game-types'
import { TTL_MAX_STATEMENT_LENGTH } from '@/lib/two-truths'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(req: NextRequest) {
  const raw = await req.json()
  const parsed = ttlStatementSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { gameId, playerId, statementA, statementB, statementC, lieIndex } = parsed.data
  const code = gameId.toUpperCase()

  const [{ data: game }, { data: player }] = await Promise.all([
    supabase.from('games').select('status, game_type').eq('id', code).maybeSingle(),
    supabase.from('players').select('id, game_id').eq('id', playerId).maybeSingle(),
  ])

  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (!isTwoTruthsGame(parseGameType(game.game_type))) {
    return NextResponse.json({ error: 'Not a two truths game' }, { status: 400 })
  }
  if (game.status !== 'waiting') {
    return NextResponse.json({ error: 'Statements can only be submitted in the lobby' }, { status: 400 })
  }
  if (!player || player.game_id !== code) {
    return NextResponse.json({ error: 'Player not found in this game' }, { status: 404 })
  }

  const statements = [statementA.trim(), statementB.trim(), statementC.trim()]
  if (statements.some((s) => s.length > TTL_MAX_STATEMENT_LENGTH)) {
    return NextResponse.json({ error: `Each statement must be ${TTL_MAX_STATEMENT_LENGTH} characters or less` }, { status: 400 })
  }
  if (new Set(statements.map((s) => s.toLowerCase())).size < 3) {
    return NextResponse.json({ error: 'All three statements must be different' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('ttl_statements')
    .upsert(
      {
        game_id: code,
        player_id: playerId,
        statement_a: statements[0],
        statement_b: statements[1],
        statement_c: statements[2],
        lie_index: lieIndex,
        updated_at: now,
      },
      { onConflict: 'game_id,player_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, statement: data })
}
