import type { SupabaseClient } from '@supabase/supabase-js'
import type { TicTacToeMark, TicTacToeSession } from '@/types'

export const TIC_TAC_TOE_MIN_PLAYERS = 2
export const TIC_TAC_TOE_MAX_PLAYERS = 2
export const TIC_TAC_TOE_DEFAULT_MAX_PLAYERS = 2

const EMPTY_BOARD: (TicTacToeMark | null)[] = Array(9).fill(null)

const WIN_LINES: readonly number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function checkWinner(board: (TicTacToeMark | null)[]): { mark: TicTacToeMark; line: number[] } | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line
    const mark = board[a!]
    if (mark && mark === board[b!] && mark === board[c!]) {
      return { mark, line }
    }
  }
  return null
}

export function isBoardFull(board: (TicTacToeMark | null)[]): boolean {
  return board.every((cell) => cell !== null)
}

export function ticTacToeTurnDeadline(timerSeconds: number): string | null {
  if (!timerSeconds || timerSeconds <= 0) return null
  return new Date(Date.now() + timerSeconds * 1000).toISOString()
}

export function markForPlayer(session: TicTacToeSession, playerId: string): TicTacToeMark | null {
  if (session.player_x_id === playerId) return 'X'
  if (session.player_o_id === playerId) return 'O'
  return null
}

export function currentTurnPlayerId(session: TicTacToeSession): string {
  return session.current_turn_mark === 'X' ? session.player_x_id : session.player_o_id
}

export async function initializeTicTacToeGame(
  supabase: SupabaseClient,
  gameId: string,
  playerIds: string[]
): Promise<{ error?: string }> {
  const [playerXId, playerOId] = shuffle(playerIds)
  if (!playerXId || !playerOId) return { error: 'Need exactly 2 players to start' }

  const { data: gameRow } = await supabase.from('games').select('timer_seconds').eq('id', gameId).maybeSingle()
  const timerSeconds = gameRow?.timer_seconds ?? 0

  const { data: playerRows } = await supabase.from('players').select('id, name').eq('game_id', gameId)
  const names = new Map<string, string>()
  for (const p of playerRows ?? []) names.set(p.id, p.name)

  const sessionRow: Partial<TicTacToeSession> = {
    game_id: gameId,
    player_x_id: playerXId,
    player_o_id: playerOId,
    board: EMPTY_BOARD,
    current_turn_mark: 'X',
    status: 'active',
    winner_player_id: null,
    is_draw: false,
    status_message: `${names.get(playerXId) ?? 'Player'}'s turn (X)`,
    turn_deadline_at: ticTacToeTurnDeadline(timerSeconds),
  }

  const { error } = await supabase.from('tic_tac_toe_sessions').insert(sessionRow)
  if (error) return { error: error.message }
  return {}
}

async function loadSession(
  supabase: SupabaseClient,
  gameId: string
): Promise<{ session: TicTacToeSession | null; error?: string }> {
  const { data, error } = await supabase.from('tic_tac_toe_sessions').select('*').eq('game_id', gameId).maybeSingle()
  if (error) return { session: null, error: error.message }
  return { session: data as TicTacToeSession | null }
}

export async function processTicTacToeMove(
  supabase: SupabaseClient,
  gameId: string,
  playerId: string,
  cellIndex: number
): Promise<{ error?: string }> {
  const { session, error: loadError } = await loadSession(supabase, gameId)
  if (loadError) return { error: loadError }
  if (!session) return { error: 'Game not found' }
  if (session.status === 'finished') return { error: 'Game already finished' }

  const mark = markForPlayer(session, playerId)
  if (!mark) return { error: 'You are not in this game' }
  if (mark !== session.current_turn_mark) return { error: "It's not your turn" }
  if (cellIndex < 0 || cellIndex > 8) return { error: 'Invalid cell' }
  if (session.board[cellIndex] !== null) return { error: 'That cell is already taken' }

  const board = [...session.board]
  board[cellIndex] = mark

  const { data: playerRows } = await supabase.from('players').select('id, name').eq('game_id', gameId)
  const names = new Map<string, string>()
  for (const p of playerRows ?? []) names.set(p.id, p.name)

  const win = checkWinner(board)
  const draw = !win && isBoardFull(board)
  const nextMark: TicTacToeMark = mark === 'X' ? 'O' : 'X'
  const winnerPlayerId = win ? (win.mark === 'X' ? session.player_x_id : session.player_o_id) : null

  const { data: gameRow } = await supabase.from('games').select('timer_seconds').eq('id', gameId).maybeSingle()
  const timerSeconds = gameRow?.timer_seconds ?? 0

  const statusMessage = win
    ? `${names.get(winnerPlayerId!) ?? 'Player'} wins!`
    : draw
      ? "It's a draw!"
      : `${names.get(nextMark === 'X' ? session.player_x_id : session.player_o_id) ?? 'Player'}'s turn (${nextMark})`

  const { error: updateError } = await supabase
    .from('tic_tac_toe_sessions')
    .update({
      board,
      current_turn_mark: nextMark,
      status: win || draw ? 'finished' : 'active',
      winner_player_id: winnerPlayerId,
      is_draw: draw,
      status_message: statusMessage,
      turn_deadline_at: win || draw ? null : ticTacToeTurnDeadline(timerSeconds),
      updated_at: new Date().toISOString(),
    })
    .eq('game_id', gameId)

  if (updateError) return { error: updateError.message }
  return {}
}

export async function processTicTacToeExpireTurn(
  supabase: SupabaseClient,
  gameId: string
): Promise<{ error?: string }> {
  const { session, error: loadError } = await loadSession(supabase, gameId)
  if (loadError) return { error: loadError }
  if (!session) return { error: 'Game not found' }
  if (session.status === 'finished') return {}
  if (!session.turn_deadline_at || new Date(session.turn_deadline_at).getTime() > Date.now()) return {}

  const { data: playerRows } = await supabase.from('players').select('id, name').eq('game_id', gameId)
  const names = new Map<string, string>()
  for (const p of playerRows ?? []) names.set(p.id, p.name)

  const { data: gameRow } = await supabase.from('games').select('timer_seconds').eq('id', gameId).maybeSingle()
  const timerSeconds = gameRow?.timer_seconds ?? 0
  const nextMark: TicTacToeMark = session.current_turn_mark === 'X' ? 'O' : 'X'
  const nextPlayerId = nextMark === 'X' ? session.player_x_id : session.player_o_id

  const { error } = await supabase
    .from('tic_tac_toe_sessions')
    .update({
      current_turn_mark: nextMark,
      status_message: `${names.get(nextPlayerId) ?? 'Player'}'s turn (${nextMark}) — time ran out`,
      turn_deadline_at: ticTacToeTurnDeadline(timerSeconds),
      updated_at: new Date().toISOString(),
    })
    .eq('game_id', gameId)

  if (error) return { error: error.message }
  return {}
}

/** Play again — same room, same X/O assignment, board cleared. */
export async function clearTicTacToeSessionData(supabase: SupabaseClient, gameId: string): Promise<{ error?: string }> {
  const { session, error: loadError } = await loadSession(supabase, gameId)
  if (loadError) return { error: loadError }
  if (!session) return {}

  const { data: playerRows } = await supabase.from('players').select('id, name').eq('game_id', gameId)
  const names = new Map<string, string>()
  for (const p of playerRows ?? []) names.set(p.id, p.name)

  const { data: gameRow } = await supabase.from('games').select('timer_seconds').eq('id', gameId).maybeSingle()
  const timerSeconds = gameRow?.timer_seconds ?? 0

  const { error } = await supabase
    .from('tic_tac_toe_sessions')
    .update({
      board: EMPTY_BOARD,
      current_turn_mark: 'X',
      status: 'active',
      winner_player_id: null,
      is_draw: false,
      status_message: `${names.get(session.player_x_id) ?? 'Player'}'s turn (X)`,
      turn_deadline_at: ticTacToeTurnDeadline(timerSeconds),
      updated_at: new Date().toISOString(),
    })
    .eq('game_id', gameId)

  if (error) return { error: error.message }
  return {}
}
