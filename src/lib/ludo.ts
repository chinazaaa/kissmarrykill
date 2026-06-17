import type { SupabaseClient } from '@supabase/supabase-js'
import { markGameFinished } from '@/lib/game-finish'
import type { Game, LudoColor, LudoPiece, LudoPlayerState, LudoSession } from '@/types'

export const LUDO_MIN_PLAYERS = 2
export const LUDO_MAX_PLAYERS = 4
export const LUDO_DEFAULT_MAX_PLAYERS = 4

export const TRACK_LENGTH = 52
const FINISH_STEPS = 57

export const LUDO_COLORS: LudoColor[] = ['red', 'green', 'yellow', 'blue']

export const LUDO_COLOR_LABELS: Record<LudoColor, string> = {
  red: 'Red',
  green: 'Green',
  yellow: 'Yellow',
  blue: 'Blue',
}

export const LUDO_COLOR_HEX: Record<LudoColor, string> = {
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
}

export const START_POS: Record<LudoColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
}

/** Colors used for each player count (opposite corners for 2-player). */
export function colorsForPlayerCount(count: number): LudoColor[] {
  if (count <= 2) return ['red', 'green']
  if (count === 3) return ['red', 'green', 'yellow']
  return ['red', 'green', 'yellow', 'blue']
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function createInitialPieces(): LudoPiece[] {
  return [0, 1, 2, 3].map((id) => ({ id, zone: 'base', pos: 0 }))
}

export function currentPlayerId(session: LudoSession): string | null {
  const order = session.turn_order ?? []
  if (order.length === 0) return null
  return order[session.current_turn_index % order.length] ?? null
}

export function ludoTurnDeadline(timerSeconds: number): string | null {
  if (!timerSeconds || timerSeconds <= 0) return null
  return new Date(Date.now() + timerSeconds * 1000).toISOString()
}

export function ludoSecondsLeft(deadlineAt: string | null | undefined): number {
  if (!deadlineAt) return 0
  return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 1000))
}

function stepsFromStart(color: LudoColor, piece: LudoPiece): number | null {
  if (piece.zone === 'base') return null
  if (piece.zone === 'finished') return FINISH_STEPS
  if (piece.zone === 'home') return 52 + piece.pos
  return (piece.pos - START_POS[color] + TRACK_LENGTH) % TRACK_LENGTH
}

function pieceAtSteps(color: LudoColor, steps: number): LudoPiece {
  if (steps >= FINISH_STEPS) return { id: 0, zone: 'finished', pos: 0 }
  if (steps >= 52) return { id: 0, zone: 'home', pos: steps - 52 }
  return { id: 0, zone: 'track', pos: (START_POS[color] + steps) % TRACK_LENGTH }
}

function trackOccupants(
  states: LudoPlayerState[],
  excludePlayerId?: string,
  excludePieceId?: number
): Map<number, { color: LudoColor; playerId: string; pieceId: number; count: number }[]> {
  const map = new Map<number, { color: LudoColor; playerId: string; pieceId: number; count: number }[]>()

  for (const row of states) {
    for (const piece of row.pieces) {
      if (piece.zone !== 'track') continue
      if (row.player_id === excludePlayerId && piece.id === excludePieceId) continue
      const list = map.get(piece.pos) ?? []
      const existing = list.find((e) => e.color === row.color && e.playerId === row.player_id)
      if (existing) {
        existing.count += 1
      } else {
        list.push({ color: row.color, playerId: row.player_id, pieceId: piece.id, count: 1 })
      }
      map.set(piece.pos, list)
    }
  }

  return map
}

function isOpponentBlockade(
  occupants: { color: LudoColor; playerId: string; count: number }[],
  myColor: LudoColor
): boolean {
  return occupants.some((o) => o.color !== myColor && o.count >= 2)
}

function isOwnBlockade(
  occupants: { color: LudoColor; playerId: string; count: number }[],
  myColor: LudoColor
): boolean {
  return occupants.some((o) => o.color === myColor && o.count >= 2)
}

function canPassTrackSquare(
  pos: number,
  color: LudoColor,
  occupants: Map<number, { color: LudoColor; playerId: string; pieceId: number; count: number }[]>
): boolean {
  const occ = occupants.get(pos) ?? []
  if (occ.length === 0) return true
  if (isOwnBlockade(occ, color)) return true
  if (isOpponentBlockade(occ, color)) return false
  return true
}

function canLandOnTrackSquare(
  pos: number,
  color: LudoColor,
  occupants: Map<number, { color: LudoColor; playerId: string; pieceId: number; count: number }[]>
): boolean {
  const occ = occupants.get(pos) ?? []
  if (occ.length === 0) return true
  if (isOpponentBlockade(occ, color)) return false
  if (occ.some((o) => o.color === color)) return true
  return true
}

export interface LudoMoveOption {
  pieceId: number
  from: LudoPiece
  to: LudoPiece
  captures: boolean
}

export function getLegalMoves(
  color: LudoColor,
  pieces: LudoPiece[],
  dice: number,
  allStates: LudoPlayerState[],
  playerId: string
): LudoMoveOption[] {
  const moves: LudoMoveOption[] = []
  const occupants = trackOccupants(allStates)

  const hasInPlay = pieces.some((p) => p.zone !== 'base')

  for (const piece of pieces) {
    if (piece.zone === 'finished') continue

    if (piece.zone === 'base') {
      if (dice !== 6) continue
      if (!hasInPlay && pieces.filter((p) => p.zone === 'base').length === pieces.length) {
        // all in base — must bring one out on 6
      }
      const start = START_POS[color]
      const occ = occupants.get(start) ?? []
      if (isOpponentBlockade(occ, color)) continue
      moves.push({
        pieceId: piece.id,
        from: piece,
        to: { id: piece.id, zone: 'track', pos: start },
        captures: occ.some((o) => o.color !== color && o.count === 1),
      })
      continue
    }

    const currentSteps = stepsFromStart(color, piece)
    if (currentSteps == null) continue

    const newSteps = currentSteps + dice
    if (newSteps > FINISH_STEPS) continue

    if (piece.zone === 'home') {
      const to = pieceAtSteps(color, newSteps)
      moves.push({
        pieceId: piece.id,
        from: piece,
        to: { ...to, id: piece.id },
        captures: false,
      })
      continue
    }

    // On track — check intermediate squares for blockades
    let blocked = false
    for (let step = 1; step <= dice; step += 1) {
      const intermediateSteps = currentSteps + step
      if (intermediateSteps > 51) break
      const intermediatePos = (START_POS[color] + intermediateSteps) % TRACK_LENGTH
      if (step < dice && !canPassTrackSquare(intermediatePos, color, occupants)) {
        blocked = true
        break
      }
    }
    if (blocked) continue

    const dest = pieceAtSteps(color, newSteps)
    if (dest.zone === 'track') {
      if (!canLandOnTrackSquare(dest.pos, color, occupants)) continue
      const occ = occupants.get(dest.pos) ?? []
      const captures = occ.some((o) => o.color !== color && o.count === 1)
      moves.push({
        pieceId: piece.id,
        from: piece,
        to: { ...dest, id: piece.id },
        captures,
      })
    } else {
      moves.push({
        pieceId: piece.id,
        from: piece,
        to: { ...dest, id: piece.id },
        captures: false,
      })
    }
  }

  return moves
}

export function hasAnyLegalMove(
  color: LudoColor,
  pieces: LudoPiece[],
  dice: number,
  allStates: LudoPlayerState[],
  playerId: string
): boolean {
  return getLegalMoves(color, pieces, dice, allStates, playerId).length > 0
}

export function allPiecesFinished(pieces: LudoPiece[]): boolean {
  return pieces.every((p) => p.zone === 'finished')
}

export function finishedPieceCount(pieces: LudoPiece[]): number {
  return pieces.filter((p) => p.zone === 'finished').length
}

function applyCapture(
  states: LudoPlayerState[],
  pos: number,
  capturingColor: LudoColor
): LudoPlayerState[] {
  return states.map((row) => {
    if (row.color === capturingColor) return row
    const nextPieces = row.pieces.map((piece) => {
      if (piece.zone === 'track' && piece.pos === pos) {
        return { ...piece, zone: 'base' as const, pos: 0 }
      }
      return piece
    })
    return { ...row, pieces: nextPieces }
  })
}

function advanceTurnIndex(session: LudoSession): number {
  return (session.current_turn_index + 1) % session.turn_order.length
}

async function loadGameState(
  supabase: SupabaseClient,
  gameId: string
): Promise<{
  session: LudoSession | null
  states: LudoPlayerState[]
  timerSeconds: number
  playerNames: Map<string, string>
}> {
  const [sessionRes, statesRes, gameRes, playersRes] = await Promise.all([
    supabase.from('ludo_sessions').select('*').eq('game_id', gameId).maybeSingle(),
    supabase.from('ludo_player_state').select('*').eq('game_id', gameId).order('player_order'),
    supabase.from('games').select('timer_seconds').eq('id', gameId).maybeSingle(),
    supabase.from('players').select('id, name').eq('game_id', gameId),
  ])

  const playerNames = new Map<string, string>()
  for (const p of playersRes.data ?? []) {
    playerNames.set(p.id, p.name)
  }

  return {
    session: sessionRes.data as LudoSession | null,
    states: (statesRes.data as LudoPlayerState[]) ?? [],
    timerSeconds: gameRes.data?.timer_seconds ?? 0,
    playerNames,
  }
}

export async function initializeLudoGame(
  supabase: SupabaseClient,
  gameId: string,
  playerIds: string[]
): Promise<{ error?: string }> {
  const turnOrder = shuffle(playerIds)
  const colors = colorsForPlayerCount(turnOrder.length)

  const { data: gameRow } = await supabase.from('games').select('timer_seconds').eq('id', gameId).maybeSingle()
  const timerSeconds = gameRow?.timer_seconds ?? 0

  const { data: playerRows } = await supabase.from('players').select('id, name').eq('game_id', gameId)
  const names = new Map<string, string>()
  for (const p of playerRows ?? []) {
    names.set(p.id, p.name)
  }

  const firstPlayerId = turnOrder[0]
  const firstName = firstPlayerId ? (names.get(firstPlayerId) ?? 'Player') : 'Player'

  const sessionRow: Partial<LudoSession> = {
    game_id: gameId,
    turn_order: turnOrder,
    current_turn_index: 0,
    phase: 'roll',
    last_dice: null,
    consecutive_sixes: 0,
    extra_turn: false,
    status_message: `${firstName}'s turn — roll the die`,
    winner_player_id: null,
    turn_deadline_at: ludoTurnDeadline(timerSeconds),
  }

  const { error: sessionError } = await supabase.from('ludo_sessions').insert(sessionRow)
  if (sessionError) return { error: sessionError.message }

  const stateRows = turnOrder.map((playerId, index) => ({
    game_id: gameId,
    player_id: playerId,
    color: colors[index]!,
    pieces: createInitialPieces(),
    player_order: index,
  }))

  const { error: statesError } = await supabase.from('ludo_player_state').insert(stateRows)
  if (statesError) return { error: statesError.message }

  return {}
}

export async function clearLudoSessionData(
  supabase: SupabaseClient,
  gameId: string
): Promise<{ error?: string }> {
  const { error: sessionError } = await supabase.from('ludo_sessions').delete().eq('game_id', gameId)
  if (sessionError) return { error: sessionError.message }

  const { error: statesError } = await supabase.from('ludo_player_state').delete().eq('game_id', gameId)
  if (statesError) return { error: statesError.message }

  return {}
}

function pickAutoMove(moves: LudoMoveOption[]): LudoMoveOption | null {
  if (moves.length === 0) return null
  if (moves.length === 1) return moves[0]!

  // Rolling a 6 with every piece still in base — all moves go to the same start square.
  const dest = moves[0]!.to
  if (
    moves.every(
      (m) => m.from.zone === 'base' && m.to.zone === 'track' && m.to.pos === dest.pos
    )
  ) {
    return [...moves].sort((a, b) => a.pieceId - b.pieceId)[0]!
  }

  const capturing = moves.filter((m) => m.captures)
  if (capturing.length > 0) return capturing[0]!
  const finishing = moves.filter((m) => m.to.zone === 'finished')
  if (finishing.length > 0) return finishing[0]!
  const enteringHome = moves.filter((m) => m.to.zone === 'home' && m.from.zone === 'track')
  if (enteringHome.length > 0) return enteringHome[0]!
  const leavingBase = moves.filter((m) => m.from.zone === 'base')
  if (leavingBase.length > 0) return leavingBase[0]!
  return moves[0]!
}

async function persistMove(
  supabase: SupabaseClient,
  gameId: string,
  session: LudoSession,
  states: LudoPlayerState[],
  playerId: string,
  move: LudoMoveOption,
  timerSeconds: number,
  playerNames: Map<string, string>
): Promise<{ error?: string }> {
  const playerRow = states.find((s) => s.player_id === playerId)
  if (!playerRow) return { error: 'Player state not found' }

  let nextStates = states.map((row) => {
    if (row.player_id !== playerId) return row
    return {
      ...row,
      pieces: row.pieces.map((p) => (p.id === move.pieceId ? move.to : p)),
    }
  })

  if (move.captures && move.to.zone === 'track') {
    nextStates = applyCapture(nextStates, move.to.pos, playerRow.color)
  }

  const myPieces = nextStates.find((s) => s.player_id === playerId)?.pieces ?? []
  const won = allPiecesFinished(myPieces)
  const name = playerNames.get(playerId) ?? 'Player'

  const rolledSix = session.last_dice === 6
  let consecutiveSixes = session.consecutive_sixes
  if (rolledSix) {
    consecutiveSixes += 1
  } else {
    consecutiveSixes = 0
  }

  let phase: LudoSession['phase'] = 'roll'
  let currentTurnIndex = session.current_turn_index
  let extraTurn = false
  let lastDice: number | null = null
  let statusMessage = ''

  const movedFromBase = move.from.zone === 'base' && move.to.zone === 'track'
  const moveNote = movedFromBase
    ? 'brought a piece onto the board'
    : move.captures
      ? 'moved and captured an opponent'
      : move.to.zone === 'finished'
        ? 'finished a piece'
        : 'moved a piece'

  if (won) {
    phase = 'finished'
    statusMessage = `${name} wins!`
    await markGameFinished(supabase, gameId)
  } else if (rolledSix && consecutiveSixes < 3) {
    extraTurn = true
    statusMessage = `${name} ${moveNote} — rolled a 6, roll again!`
  } else if (consecutiveSixes >= 3) {
    currentTurnIndex = advanceTurnIndex(session)
    consecutiveSixes = 0
    const nextId = session.turn_order[currentTurnIndex]
    statusMessage = `Three 6s in a row — turn lost. ${playerNames.get(nextId ?? '') ?? 'Next player'}'s turn`
  } else {
    currentTurnIndex = advanceTurnIndex(session)
    const nextId = session.turn_order[currentTurnIndex]
    statusMessage = `${name} ${moveNote}. ${playerNames.get(nextId ?? '') ?? 'Next player'}'s turn`
  }

  // Only write rows whose pieces actually changed (mover + any captured).
  // Writing every row would fire a postgres_changes event per row, causing a
  // reload storm on the clients and visible flicker.
  const changedRows = nextStates.filter((row) => {
    const original = states.find((s) => s.player_id === row.player_id)
    return !original || JSON.stringify(original.pieces) !== JSON.stringify(row.pieces)
  })

  const writeResults = await Promise.all(
    changedRows.map((row) =>
      supabase
        .from('ludo_player_state')
        .update({ pieces: row.pieces })
        .eq('game_id', gameId)
        .eq('player_id', row.player_id)
    )
  )
  const writeError = writeResults.find((r) => r.error)
  if (writeError?.error) return { error: writeError.error.message }

  const { error: sessionError } = await supabase
    .from('ludo_sessions')
    .update({
      phase,
      current_turn_index: currentTurnIndex,
      last_dice: lastDice,
      consecutive_sixes: consecutiveSixes,
      extra_turn: extraTurn,
      status_message: statusMessage,
      winner_player_id: won ? playerId : null,
      turn_deadline_at: phase === 'finished' ? null : ludoTurnDeadline(timerSeconds),
      updated_at: new Date().toISOString(),
    })
    .eq('game_id', gameId)

  if (sessionError) return { error: sessionError.message }
  return {}
}

export async function processLudoRoll(
  supabase: SupabaseClient,
  gameId: string,
  playerId: string
): Promise<{ error?: string; dice?: number }> {
  const { session, states, timerSeconds, playerNames } = await loadGameState(supabase, gameId)
  if (!session) return { error: 'Session not found' }
  if (session.phase !== 'roll') return { error: 'Not roll phase' }
  if (currentPlayerId(session) !== playerId) return { error: 'Not your turn' }

  const dice = Math.floor(Math.random() * 6) + 1
  const playerRow = states.find((s) => s.player_id === playerId)
  if (!playerRow) return { error: 'Player state not found' }

  const moves = getLegalMoves(playerRow.color, playerRow.pieces, dice, states, playerId)
  const name = playerNames.get(playerId) ?? 'Player'

  if (moves.length === 0) {
    let consecutiveSixes = session.consecutive_sixes
    if (dice === 6) consecutiveSixes += 1
    else consecutiveSixes = 0

    if (dice === 6 && consecutiveSixes < 3) {
      const { error } = await supabase
        .from('ludo_sessions')
        .update({
          last_dice: dice,
          consecutive_sixes: consecutiveSixes,
          phase: 'roll',
          status_message: `${name} rolled a 6 but has no moves — roll again!`,
          turn_deadline_at: ludoTurnDeadline(timerSeconds),
          updated_at: new Date().toISOString(),
        })
        .eq('game_id', gameId)
      if (error) return { error: error.message }
      return { dice }
    }

    if (consecutiveSixes >= 3) {
      const nextIndex = advanceTurnIndex(session)
      const nextId = session.turn_order[nextIndex]
      const { error } = await supabase
        .from('ludo_sessions')
        .update({
          last_dice: null,
          consecutive_sixes: 0,
          current_turn_index: nextIndex,
          phase: 'roll',
          status_message: `Three 6s in a row — turn lost. ${playerNames.get(nextId ?? '') ?? 'Next player'}'s turn`,
          turn_deadline_at: ludoTurnDeadline(timerSeconds),
          updated_at: new Date().toISOString(),
        })
        .eq('game_id', gameId)
      if (error) return { error: error.message }
      return { dice }
    }

    const nextIndex = advanceTurnIndex(session)
    const nextId = session.turn_order[nextIndex]
    const { error } = await supabase
      .from('ludo_sessions')
      .update({
        last_dice: null,
        consecutive_sixes: 0,
        current_turn_index: nextIndex,
        phase: 'roll',
        status_message: `${name} rolled ${dice} — no moves. ${playerNames.get(nextId ?? '') ?? 'Next player'}'s turn`,
        turn_deadline_at: ludoTurnDeadline(timerSeconds),
        updated_at: new Date().toISOString(),
      })
      .eq('game_id', gameId)
    if (error) return { error: error.message }
    return { dice }
  }

  const { error } = await supabase
    .from('ludo_sessions')
    .update({
      last_dice: dice,
      phase: 'move',
      status_message: `${name} rolled ${dice} — choose a piece to move`,
      turn_deadline_at: ludoTurnDeadline(timerSeconds),
      updated_at: new Date().toISOString(),
    })
    .eq('game_id', gameId)

  if (error) return { error: error.message }
  return { dice }
}

export async function processLudoMove(
  supabase: SupabaseClient,
  gameId: string,
  playerId: string,
  pieceId: number
): Promise<{ error?: string }> {
  const { session, states, timerSeconds, playerNames } = await loadGameState(supabase, gameId)
  if (!session) return { error: 'Session not found' }
  if (session.phase !== 'move') return { error: 'Not move phase' }
  if (currentPlayerId(session) !== playerId) return { error: 'Not your turn' }
  if (!session.last_dice) return { error: 'Roll first' }

  const playerRow = states.find((s) => s.player_id === playerId)
  if (!playerRow) return { error: 'Player state not found' }

  const moves = getLegalMoves(playerRow.color, playerRow.pieces, session.last_dice, states, playerId)
  const move = moves.find((m) => m.pieceId === pieceId)
  if (!move) return { error: 'Invalid move' }

  return persistMove(supabase, gameId, session, states, playerId, move, timerSeconds, playerNames)
}

export async function processLudoExpireTurn(
  supabase: SupabaseClient,
  gameId: string
): Promise<{ error?: string }> {
  const { session, states, timerSeconds, playerNames } = await loadGameState(supabase, gameId)
  if (!session || session.phase === 'finished') return {}

  const playerId = currentPlayerId(session)
  if (!playerId) return { error: 'No current player' }

  if (session.phase === 'roll') {
    return processLudoRoll(supabase, gameId, playerId)
  }

  const playerRow = states.find((s) => s.player_id === playerId)
  if (!playerRow || !session.last_dice) return { error: 'Invalid state' }

  const moves = getLegalMoves(playerRow.color, playerRow.pieces, session.last_dice, states, playerId)
  const auto = pickAutoMove(moves)
  if (!auto) {
    const nextIndex = advanceTurnIndex(session)
    const nextId = session.turn_order[nextIndex]
    const { error } = await supabase
      .from('ludo_sessions')
      .update({
        last_dice: null,
        phase: 'roll',
        current_turn_index: nextIndex,
        consecutive_sixes: 0,
        status_message: `Time's up — ${playerNames.get(nextId ?? '') ?? 'Next player'}'s turn`,
        turn_deadline_at: ludoTurnDeadline(timerSeconds),
        updated_at: new Date().toISOString(),
      })
      .eq('game_id', gameId)
    if (error) return { error: error.message }
    return {}
  }

  return persistMove(supabase, gameId, session, states, playerId, auto, timerSeconds, playerNames)
}

export type LudoHostMode = 'spectator' | 'player'

const LUDO_HOST_MODE_KEY = 'ludo_host_mode'

export function getLudoHostMode(gameCode: string): LudoHostMode {
  if (typeof window === 'undefined') return 'spectator'
  return (localStorage.getItem(`${LUDO_HOST_MODE_KEY}_${gameCode}`) as LudoHostMode) ?? 'spectator'
}

export function setLudoHostMode(gameCode: string, mode: LudoHostMode): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${LUDO_HOST_MODE_KEY}_${gameCode}`, mode)
}
