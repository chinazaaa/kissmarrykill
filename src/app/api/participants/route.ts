import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizeGender } from '@/lib/participants'
import { assertHostGame, deleteJoinerPair } from '@/lib/game-admin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function PATCH(req: NextRequest) {
  const {
    gameCode,
    hostToken,
    participantId,
    name: rawName,
    gender: rawGender,
  } = await req.json()

  if (!gameCode || !hostToken || !participantId) {
    return NextResponse.json({ error: 'gameCode, hostToken, and participantId are required' }, { status: 400 })
  }

  const auth = await assertHostGame(supabase, gameCode, hostToken)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data: participant } = await supabase
    .from('participants')
    .select('*')
    .eq('id', participantId)
    .eq('game_id', auth.id)
    .maybeSingle()

  if (!participant) return NextResponse.json({ error: 'Participant not found' }, { status: 404 })

  const updates: { name?: string; gender?: 'male' | 'female' } = {}

  if (rawName !== undefined) {
    const name = String(rawName).trim()
    if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })

    const { data: nameClash } = await supabase
      .from('participants')
      .select('id')
      .eq('game_id', auth.id)
      .ilike('name', name)
      .neq('id', participantId)
      .maybeSingle()

    if (nameClash) {
      return NextResponse.json({ error: 'That name is already on the list' }, { status: 400 })
    }
    updates.name = name
  }

  if (rawGender !== undefined) {
    const gender = normalizeGender(String(rawGender))
    if (!gender) return NextResponse.json({ error: 'Gender must be male or female' }, { status: 400 })
    updates.gender = gender
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('participants')
    .update(updates)
    .eq('id', participantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (auth.game!.participant_mode === 'joiners') {
    const { data: player } = await supabase
      .from('players')
      .select('id, name, gender')
      .eq('game_id', auth.id)
      .eq('name', participant.name)
      .maybeSingle()

    if (player) {
      const playerUpdates: { name?: string; gender?: string } = {}
      if (updates.name) playerUpdates.name = updates.name
      if (updates.gender && player.gender !== 'both') playerUpdates.gender = updates.gender
      if (Object.keys(playerUpdates).length > 0) {
        await supabase.from('players').update(playerUpdates).eq('id', player.id)
      }
    }
  }

  return NextResponse.json({ participant: updated })
}

export async function DELETE(req: NextRequest) {
  const { gameCode, hostToken, participantId } = await req.json()

  if (!gameCode || !hostToken || !participantId) {
    return NextResponse.json({ error: 'gameCode, hostToken, and participantId are required' }, { status: 400 })
  }

  const auth = await assertHostGame(supabase, gameCode, hostToken)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data: participant } = await supabase
    .from('participants')
    .select('*')
    .eq('id', participantId)
    .eq('game_id', auth.id)
    .maybeSingle()

  if (!participant) return NextResponse.json({ error: 'Participant not found' }, { status: 404 })

  if (auth.game!.participant_mode === 'joiners') {
    const { data: linkedPlayer } = await supabase
      .from('players')
      .select('id, name')
      .eq('game_id', auth.id)
      .eq('name', participant.name)
      .maybeSingle()

    if (linkedPlayer) {
      await deleteJoinerPair(supabase, auth.id, linkedPlayer)
      return NextResponse.json({ success: true })
    }
  }

  const { error } = await supabase.from('participants').delete().eq('id', participantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
