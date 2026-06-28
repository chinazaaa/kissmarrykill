import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseGameType, isWhoSaidThis } from '@/lib/game-types'
import { assertHostGame } from '@/lib/game-admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function validateAuthorParticipant(gameIdUpper: string, authorId: string) {
  const { data: authorParticipant } = await supabase
    .from('participants')
    .select('id')
    .eq('id', authorId)
    .eq('game_id', gameIdUpper)
    .maybeSingle()

  if (!authorParticipant) {
    return NextResponse.json({ error: 'Pick a name from the game list' }, { status: 400 })
  }
  return null
}

export async function POST(req: NextRequest) {
  const { playerId, hostToken, gameId, quoteText, authorParticipantId, quoteId } = await req.json()

  if (!gameId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const isHostRequest = typeof hostToken === 'string' && hostToken.trim().length > 0
  if (!isHostRequest && !playerId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const quote = typeof quoteText === 'string' ? quoteText.trim() : ''
  if (!quote) {
    return NextResponse.json({ error: 'Enter a quote before submitting' }, { status: 400 })
  }
  if (quote.length > 500) {
    return NextResponse.json({ error: 'Quote is too long (500 characters max)' }, { status: 400 })
  }

  const authorId = typeof authorParticipantId === 'string' ? authorParticipantId.trim() : ''
  if (!authorId) {
    return NextResponse.json({ error: 'Pick who said it from the name list' }, { status: 400 })
  }

  const gameIdUpper = gameId.toUpperCase()
  const quoteIdTrimmed = typeof quoteId === 'string' ? quoteId.trim() : ''
  const now = new Date().toISOString()

  if (isHostRequest) {
    const auth = await assertHostGame(getSupabaseAdmin(), gameIdUpper, hostToken.trim())
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!isWhoSaidThis(parseGameType(auth.game!.game_type))) {
      return NextResponse.json({ error: 'This game type does not use quote pool' }, { status: 400 })
    }

    const authorError = await validateAuthorParticipant(gameIdUpper, authorId)
    if (authorError) return authorError

    if (quoteIdTrimmed) {
      const { data: existing } = await supabase
        .from('wst_quote_pool')
        .select('id, player_id')
        .eq('id', quoteIdTrimmed)
        .eq('game_id', gameIdUpper)
        .maybeSingle()

      if (!existing) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
      if (existing.player_id != null) {
        return NextResponse.json({ error: 'You can only edit host-added quotes here' }, { status: 403 })
      }

      const { data, error } = await supabase
        .from('wst_quote_pool')
        .update({
          quote_text: quote,
          author_participant_id: authorId,
          updated_at: now,
        })
        .eq('id', quoteIdTrimmed)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({
        success: true,
        entry: data,
        quoteText: quote,
        authorParticipantId: authorId,
      })
    }

    const { data, error } = await supabase
      .from('wst_quote_pool')
      .insert({
        game_id: gameIdUpper,
        player_id: null,
        quote_text: quote,
        author_participant_id: authorId,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      entry: data,
      quoteText: quote,
      authorParticipantId: authorId,
    })
  }

  const [{ data: game }, { data: player }] = await Promise.all([
    supabase.from('games').select('status, game_type').eq('id', gameIdUpper).maybeSingle(),
    supabase.from('players').select('id, participant_id, game_id').eq('id', playerId).maybeSingle(),
  ])

  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (!isWhoSaidThis(parseGameType(game.game_type))) {
    return NextResponse.json({ error: 'This game type does not use quote pool' }, { status: 400 })
  }
  if (game.status !== 'waiting') {
    return NextResponse.json({ error: 'Quote pool is closed — the game has already started' }, { status: 400 })
  }
  if (!player || player.game_id !== gameIdUpper) {
    return NextResponse.json({ error: 'Player not found in this game' }, { status: 404 })
  }
  if (!player.participant_id) {
    return NextResponse.json({ error: 'Claim your name from the list before submitting a quote' }, { status: 400 })
  }

  const authorError = await validateAuthorParticipant(gameIdUpper, authorId)
  if (authorError) return authorError

  if (quoteIdTrimmed) {
    const { data: existing } = await supabase
      .from('wst_quote_pool')
      .select('id, player_id')
      .eq('id', quoteIdTrimmed)
      .eq('game_id', gameIdUpper)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }
    if (existing.player_id !== playerId) {
      return NextResponse.json({ error: 'You can only edit your own quotes' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('wst_quote_pool')
      .update({
        quote_text: quote,
        author_participant_id: authorId,
        updated_at: now,
      })
      .eq('id', quoteIdTrimmed)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      entry: data,
      quoteText: quote,
      authorParticipantId: authorId,
    })
  }

  const { data, error } = await supabase
    .from('wst_quote_pool')
    .insert({
      game_id: gameIdUpper,
      player_id: playerId,
      quote_text: quote,
      author_participant_id: authorId,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    entry: data,
    quoteText: quote,
    authorParticipantId: authorId,
  })
}

export async function DELETE(req: NextRequest) {
  const { playerId, hostToken, gameId, quoteId } = await req.json()

  if (!gameId || !quoteId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const isHostRequest = typeof hostToken === 'string' && hostToken.trim().length > 0
  if (!isHostRequest && !playerId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const gameIdUpper = gameId.toUpperCase()
  const quoteIdTrimmed = typeof quoteId === 'string' ? quoteId.trim() : ''
  if (!quoteIdTrimmed) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (isHostRequest) {
    const auth = await assertHostGame(getSupabaseAdmin(), gameIdUpper, hostToken.trim())
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { data: existing } = await supabase
      .from('wst_quote_pool')
      .select('id, player_id')
      .eq('id', quoteIdTrimmed)
      .eq('game_id', gameIdUpper)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    if (existing.player_id != null) {
      return NextResponse.json({ error: 'You can only remove host-added quotes here' }, { status: 403 })
    }

    const { error } = await supabase.from('wst_quote_pool').delete().eq('id', quoteIdTrimmed)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  }

  const { data: game } = await supabase.from('games').select('status, game_type').eq('id', gameIdUpper).maybeSingle()

  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (game.status !== 'waiting') {
    return NextResponse.json({ error: 'Quote pool is closed' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('wst_quote_pool')
    .select('id, player_id')
    .eq('id', quoteIdTrimmed)
    .eq('game_id', gameIdUpper)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  if (existing.player_id !== playerId) {
    return NextResponse.json({ error: 'You can only remove your own quotes' }, { status: 403 })
  }

  const { error } = await supabase.from('wst_quote_pool').delete().eq('id', quoteIdTrimmed)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
