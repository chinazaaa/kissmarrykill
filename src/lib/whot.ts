import type { SupabaseClient } from '@supabase/supabase-js'
import { markGameFinished } from '@/lib/game-finish'
import type { WhotCard, WhotPlayerHand, WhotSession, WhotShape } from '@/types'

export const WHOT_MIN_PLAYERS = 2
export const WHOT_MAX_PLAYERS = 6
export const WHOT_DEFAULT_MAX_PLAYERS = 6

export const WHOT_SHAPES: WhotShape[] = ['circle', 'cross', 'triangle', 'square', 'star', 'whot']

export const WHOT_SHAPE_LABELS: Record<WhotShape, string> = {
  circle: 'Circle',
  cross: 'Cross',
  triangle: 'Triangle',
  square: 'Square',
  star: 'Star',
  whot: 'WHOT',
}

export const WHOT_SHAPE_EMOJI: Record<WhotShape, string> = {
  circle: '⭕',
  cross: '✖️',
  triangle: '🔺',
  square: '🟥',
  star: '⭐',
  whot: '🃏',
}

/** Standard 54-card Nigerian Whot deck composition. */
const DECK_COMPOSITION: Record<Exclude<WhotShape, 'whot'>, number[]> = {
  circle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  cross: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  square: [1, 2, 3, 4, 5, 7, 8],
  star: [1, 2, 3, 4, 5, 7, 8],
}

const WHOT_COUNT = 5
const STARTER_SPECIALS = new Set([1, 2, 5, 8, 14, 20])

export function buildWhotDeck(): WhotCard[] {
  const deck: WhotCard[] = []
  for (const [shape, numbers] of Object.entries(DECK_COMPOSITION) as [Exclude<WhotShape, 'whot'>, number[]][]) {
    for (const number of numbers) {
      deck.push({ id: `${shape}-${number}`, shape, number })
    }
  }
  for (let i = 0; i < WHOT_COUNT; i += 1) {
    deck.push({ id: `whot-20-${i}`, shape: 'whot', number: 20 })
  }
  return deck
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function currentPlayerId(session: WhotSession): string | null {
  const order = session.turn_order ?? []
  if (order.length === 0) return null
  return order[session.current_turn_index % order.length] ?? null
}

export function whotTurnDeadline(timerSeconds: number): string | null {
  if (!timerSeconds || timerSeconds <= 0) return null
  return new Date(Date.now() + timerSeconds * 1000).toISOString()
}

export function whotSecondsLeft(deadlineAt: string | null | undefined): number {
  if (!deadlineAt) return 0
  return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 1000))
}

export function cardLabel(card: WhotCard): string {
  if (card.number === 20) return 'WHOT'
  return `${WHOT_SHAPE_EMOJI[card.shape]} ${card.number}`
}

export function specialCardMessage(number: number): string | null {
  switch (number) {
    case 1:
      return 'Hold On — take another turn'
    case 2:
      return 'Pick 2 — next player must play a 2 or draw'
    case 5:
      return 'Pick 3 — next player must play a 5 or draw'
    case 8:
      return 'Suspension — skip the next player'
    case 14:
      return 'General Market — everyone else draws 1'
    case 20:
      return 'WHOT — choose a shape or number to match'
    default:
      return null
  }
}

export function canPlayCard(card: WhotCard, session: WhotSession): boolean {
  if (card.number === 20) return true

  if ((session.pick_two_stack ?? 0) > 0) return card.number === 2
  if ((session.pick_five_stack ?? 0) > 0) return card.number === 5

  if (session.required_shape) {
    return card.shape === session.required_shape
  }
  if (session.required_number != null) {
    return card.number === session.required_number
  }

  const top = session.top_card
  if (!top) return true
  if (top.number === 20) return true
  return card.shape === top.shape || card.number === top.number
}

export function hasPlayableCard(hand: WhotCard[], session: WhotSession): boolean {
  return hand.some((c) => canPlayCard(c, session))
}

function dealCount(playerCount: number): number {
  return playerCount === 2 ? 6 : 5
}

function drawStarter(deck: WhotCard[]): { top: WhotCard; rest: WhotCard[] } {
  const pile = [...deck]
  while (pile.length > 0) {
    const top = pile.pop()!
    if (!STARTER_SPECIALS.has(top.number)) {
      return { top, rest: pile }
    }
    pile.unshift(top)
  }
  const top = pile.pop()!
  return { top, rest: pile }
}

export async function initializeWhotGame(
  supabase: SupabaseClient,
  gameId: string,
  playerIds: string[]
): Promise<{ error?: string }> {
  const turnOrder = shuffle(playerIds)
  const deck = shuffle(buildWhotDeck())
  const cardsEach = dealCount(turnOrder.length)

  const hands: WhotCard[][] = turnOrder.map(() => [])
  let drawPile = [...deck]

  for (let c = 0; c < cardsEach; c += 1) {
    for (let p = 0; p < turnOrder.length; p += 1) {
      const card = drawPile.pop()
      if (card) hands[p].push(card)
    }
  }

  const { top, rest } = drawStarter(drawPile)
  drawPile = rest

  const { data: gameRow } = await supabase.from('games').select('timer_seconds').eq('id', gameId).maybeSingle()
  const timerSeconds = gameRow?.timer_seconds ?? 0

  const { data: playerRows } = await supabase.from('players').select('id, name').eq('game_id', gameId)
  const initNames = new Map<string, string>()
  for (const p of playerRows ?? []) {
    initNames.set(p.id, p.name)
  }

  const firstPlayerId = turnOrder[0]
  const firstName = firstPlayerId ? (initNames.get(firstPlayerId) ?? 'Player') : 'Player'
  const sessionRow: Partial<WhotSession> = {
    game_id: gameId,
    turn_order: turnOrder,
    current_turn_index: 0,
    phase: 'playing',
    draw_pile: drawPile,
    top_card: top,
    required_shape: null,
    required_number: null,
    pick_two_stack: 0,
    pick_five_stack: 0,
    status_message: `${firstName}'s turn — match ${cardLabel(top)}`,
    winner_player_id: null,
    turn_deadline_at: whotTurnDeadline(timerSeconds),
  }

  const { error: sessionError } = await supabase.from('whot_sessions').insert(sessionRow)
  if (sessionError) return { error: sessionError.message }

  const handRows = turnOrder.map((playerId, index) => ({
    game_id: gameId,
    player_id: playerId,
    cards: hands[index],
    player_order: index,
  }))

  const { error: handsError } = await supabase.from('whot_player_hands').insert(handRows)
  if (handsError) return { error: handsError.message }

  return {}
}

export async function clearWhotSessionData(
  supabase: SupabaseClient,
  gameId: string
): Promise<{ error?: string }> {
  const { error: sessionError } = await supabase.from('whot_sessions').delete().eq('game_id', gameId)
  if (sessionError) return { error: sessionError.message }

  const { error: handsError } = await supabase.from('whot_player_hands').delete().eq('game_id', gameId)
  if (handsError) return { error: handsError.message }

  return {}
}

async function loadGameState(
  supabase: SupabaseClient,
  gameId: string
): Promise<{
  session: WhotSession | null
  hands: WhotPlayerHand[]
  timerSeconds: number
  playerNames: Map<string, string>
}> {
  const [sessionRes, handsRes, gameRes, playersRes] = await Promise.all([
    supabase.from('whot_sessions').select('*').eq('game_id', gameId).maybeSingle(),
    supabase.from('whot_player_hands').select('*').eq('game_id', gameId).order('player_order'),
    supabase.from('games').select('timer_seconds').eq('id', gameId).maybeSingle(),
    supabase.from('players').select('id, name').eq('game_id', gameId),
  ])

  const playerNames = new Map<string, string>()
  for (const p of playersRes.data ?? []) {
    playerNames.set(p.id, p.name)
  }

  return {
    session: sessionRes.data as WhotSession | null,
    hands: (handsRes.data as WhotPlayerHand[]) ?? [],
    timerSeconds: gameRes.data?.timer_seconds ?? 0,
    playerNames,
  }
}

function handForPlayer(hands: WhotPlayerHand[], playerId: string): WhotCard[] {
  const row = hands.find((h) => h.player_id === playerId)
  return (row?.cards as WhotCard[]) ?? []
}

function updateHand(hands: WhotPlayerHand[], playerId: string, cards: WhotCard[]): WhotPlayerHand[] {
  return hands.map((h) => (h.player_id === playerId ? { ...h, cards } : h))
}

function drawCards(pile: WhotCard[], count: number): { drawn: WhotCard[]; rest: WhotCard[] } {
  const drawn: WhotCard[] = []
  const rest = [...pile]
  for (let i = 0; i < count && rest.length > 0; i += 1) {
    const card = rest.pop()
    if (card) drawn.push(card)
  }
  return { drawn, rest }
}

function playerName(playerNames: Map<string, string>, playerId: string): string {
  return playerNames.get(playerId) ?? 'Player'
}

async function finishIfEmptyHand(
  supabase: SupabaseClient,
  gameId: string,
  session: WhotSession,
  playerId: string,
  playerNames: Map<string, string>
): Promise<WhotSession | null> {
  const handsRes = await supabase.from('whot_player_hands').select('player_id, cards').eq('game_id', gameId)
  const hand = (handsRes.data ?? []).find((h) => h.player_id === playerId)
  const cards = (hand?.cards as WhotCard[]) ?? []
  if (cards.length > 0) return session

  const name = playerName(playerNames, playerId)
  const finished: Partial<WhotSession> = {
    phase: 'finished',
    winner_player_id: playerId,
    status_message: `${name} wins!`,
    turn_deadline_at: null,
  }

  await supabase.from('whot_sessions').update(finished).eq('game_id', gameId)
  await markGameFinished(supabase, gameId)

  return { ...session, ...finished } as WhotSession
}

type TurnAdvance = {
  nextIndex: number
  holdOn: boolean
  skipNext: boolean
}

function computeNextTurn(session: WhotSession, cardNumber: number): TurnAdvance {
  if (cardNumber === 1) {
    return { nextIndex: session.current_turn_index, holdOn: true, skipNext: false }
  }
  if (cardNumber === 8) {
    const len = session.turn_order.length
    return { nextIndex: (session.current_turn_index + 2) % len, holdOn: false, skipNext: true }
  }
  const len = session.turn_order.length
  return { nextIndex: (session.current_turn_index + 1) % len, holdOn: false, skipNext: false }
}

async function applyGeneralMarket(
  supabase: SupabaseClient,
  gameId: string,
  currentPlayerId: string,
  drawPile: WhotCard[],
  hands: WhotPlayerHand[]
): Promise<{ drawPile: WhotCard[]; hands: WhotPlayerHand[] }> {
  let pile = [...drawPile]
  let nextHands = [...hands]

  for (const row of nextHands) {
    if (row.player_id === currentPlayerId) continue
    const { drawn, rest } = drawCards(pile, 1)
    pile = rest
    if (drawn.length > 0) {
      const cards = [...((row.cards as WhotCard[]) ?? []), ...drawn]
      nextHands = updateHand(nextHands, row.player_id, cards)
      await supabase
        .from('whot_player_hands')
        .update({ cards })
        .eq('game_id', gameId)
        .eq('player_id', row.player_id)
    }
  }

  return { drawPile: pile, hands: nextHands }
}

async function persistSession(
  supabase: SupabaseClient,
  gameId: string,
  patch: Partial<WhotSession>,
  timerSeconds: number
): Promise<void> {
  await supabase
    .from('whot_sessions')
    .update({
      ...patch,
      turn_deadline_at: patch.phase === 'finished' ? null : whotTurnDeadline(timerSeconds),
      updated_at: new Date().toISOString(),
    })
    .eq('game_id', gameId)
}

export async function processWhotPlay(
  supabase: SupabaseClient,
  gameId: string,
  playerId: string,
  cardId: string
): Promise<{ error?: string }> {
  const { session, hands, timerSeconds, playerNames } = await loadGameState(supabase, gameId)
  if (!session) return { error: 'Session not found' }
  if (session.phase === 'finished') return { error: 'Game is finished' }
  if (session.phase === 'choose_whot') return { error: 'Choose WHOT shape or number first' }

  const currentId = currentPlayerId(session)
  if (currentId !== playerId) return { error: 'Not your turn' }

  const hand = handForPlayer(hands, playerId)
  const cardIndex = hand.findIndex((c) => c.id === cardId)
  if (cardIndex < 0) return { error: 'Card not in hand' }

  const card = hand[cardIndex]
  if (!canPlayCard(card, session)) return { error: 'Cannot play that card' }

  const newHand = hand.filter((_, i) => i !== cardIndex)
  await supabase
    .from('whot_player_hands')
    .update({ cards: newHand })
    .eq('game_id', gameId)
    .eq('player_id', playerId)

  let pickTwo = session.pick_two_stack ?? 0
  let pickFive = session.pick_five_stack ?? 0

  if (card.number === 2) {
    pickTwo = pickTwo > 0 ? pickTwo + 2 : 2
    pickFive = 0
  } else if (card.number === 5) {
    pickFive = pickFive > 0 ? pickFive + 3 : 3
    pickTwo = 0
  } else {
    if (pickTwo > 0 || pickFive > 0) {
      pickTwo = 0
      pickFive = 0
    }
  }

  if (card.number === 20) {
    await persistSession(
      supabase,
      gameId,
      {
        top_card: card,
        required_shape: null,
        required_number: null,
        pick_two_stack: pickTwo,
        pick_five_stack: pickFive,
        phase: 'choose_whot',
        status_message: `${playerName(playerNames, playerId)} played WHOT — choose shape or number`,
      },
      timerSeconds
    )

    if (newHand.length === 0) {
      await finishIfEmptyHand(supabase, gameId, session, playerId, playerNames)
    }
    return {}
  }

  let drawPile = (session.draw_pile as WhotCard[]) ?? []
  let nextHands = hands

  if (card.number === 14) {
    const market = await applyGeneralMarket(supabase, gameId, playerId, drawPile, hands)
    drawPile = market.drawPile
    nextHands = market.hands
  }

  const advance = computeNextTurn(session, card.number)
  const nextPlayerId = session.turn_order[advance.nextIndex]
  const special = specialCardMessage(card.number)

  let status = advance.holdOn
    ? `${playerName(playerNames, playerId)} — Hold On, go again!`
    : `${playerName(playerNames, nextPlayerId)}'s turn — match ${cardLabel(card)}`

  if (special && !advance.holdOn) {
    status = `${special}. ${status}`
  }
  if (pickTwo > 0) status = `Pick 2 active (${pickTwo} cards). ${status}`
  if (pickFive > 0) status = `Pick 3 active (${pickFive} cards). ${status}`

  await persistSession(
    supabase,
    gameId,
    {
      top_card: card,
      required_shape: null,
      required_number: null,
      pick_two_stack: pickTwo,
      pick_five_stack: pickFive,
      draw_pile: drawPile,
      current_turn_index: advance.nextIndex,
      phase: 'playing',
      status_message: status,
    },
    timerSeconds
  )

  if (newHand.length === 0) {
    await finishIfEmptyHand(supabase, gameId, session, playerId, playerNames)
  }

  return {}
}

export async function processWhotDraw(
  supabase: SupabaseClient,
  gameId: string,
  playerId: string
): Promise<{ error?: string }> {
  const { session, hands, timerSeconds, playerNames } = await loadGameState(supabase, gameId)
  if (!session) return { error: 'Session not found' }
  if (session.phase === 'finished') return { error: 'Game is finished' }
  if (session.phase === 'choose_whot') return { error: 'Choose WHOT shape or number first' }

  const currentId = currentPlayerId(session)
  if (currentId !== playerId) return { error: 'Not your turn' }

  let drawPile = (session.draw_pile as WhotCard[]) ?? []
  const pickTwo = session.pick_two_stack ?? 0
  const pickFive = session.pick_five_stack ?? 0
  const drawCount = pickTwo > 0 ? pickTwo : pickFive > 0 ? pickFive : 1

  const { drawn, rest } = drawCards(drawPile, drawCount)
  if (drawn.length === 0) return { error: 'Draw pile is empty' }

  drawPile = rest
  const hand = handForPlayer(hands, playerId)
  const newHand = [...hand, ...drawn]

  await supabase
    .from('whot_player_hands')
    .update({ cards: newHand })
    .eq('game_id', gameId)
    .eq('player_id', playerId)

  const len = session.turn_order.length
  const nextIndex = (session.current_turn_index + 1) % len
  const nextPlayerId = session.turn_order[nextIndex]

  const penaltyMsg =
    pickTwo > 0
      ? `${playerName(playerNames, playerId)} drew ${drawn.length} (Pick 2)`
      : pickFive > 0
        ? `${playerName(playerNames, playerId)} drew ${drawn.length} (Pick 3)`
        : `${playerName(playerNames, playerId)} drew 1 card`

  await persistSession(
    supabase,
    gameId,
    {
      draw_pile: drawPile,
      pick_two_stack: 0,
      pick_five_stack: 0,
      current_turn_index: nextIndex,
      status_message: `${penaltyMsg}. ${playerName(playerNames, nextPlayerId)}'s turn`,
    },
    timerSeconds
  )

  return {}
}

export async function processWhotChoose(
  supabase: SupabaseClient,
  gameId: string,
  playerId: string,
  choice: { shape?: WhotShape; number?: number }
): Promise<{ error?: string }> {
  const { session, timerSeconds, playerNames } = await loadGameState(supabase, gameId)
  if (!session) return { error: 'Session not found' }
  if (session.phase !== 'choose_whot') return { error: 'Not choosing WHOT' }

  const currentId = currentPlayerId(session)
  if (currentId !== playerId) return { error: 'Not your turn' }

  const hasShape = choice.shape != null && choice.shape !== 'whot'
  const hasNumber = choice.number != null && choice.number >= 1 && choice.number <= 14
  if (!hasShape && !hasNumber) return { error: 'Choose a shape or number' }
  if (hasShape && hasNumber) return { error: 'Choose shape or number, not both' }

  const len = session.turn_order.length
  const nextIndex = (session.current_turn_index + 1) % len
  const nextPlayerId = session.turn_order[nextIndex]

  const requirement = hasShape
    ? `match ${WHOT_SHAPE_LABELS[choice.shape!]}`
    : `match number ${choice.number}`

  await persistSession(
    supabase,
    gameId,
    {
      required_shape: hasShape ? choice.shape! : null,
      required_number: hasNumber ? choice.number! : null,
      pick_two_stack: session.pick_two_stack ?? 0,
      pick_five_stack: session.pick_five_stack ?? 0,
      current_turn_index: nextIndex,
      phase: 'playing',
      status_message: `${playerName(playerNames, nextPlayerId)}'s turn — ${requirement}`,
    },
    timerSeconds
  )

  return {}
}

export type WhotHostMode = 'spectator' | 'player'

const WHOT_HOST_MODE_KEY = 'whot_host_mode'

export function getWhotHostMode(gameCode: string): WhotHostMode {
  if (typeof window === 'undefined') return 'spectator'
  return (localStorage.getItem(`${WHOT_HOST_MODE_KEY}_${gameCode}`) as WhotHostMode) ?? 'spectator'
}

export function setWhotHostMode(gameCode: string, mode: WhotHostMode): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${WHOT_HOST_MODE_KEY}_${gameCode}`, mode)
}
