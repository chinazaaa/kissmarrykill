import type { SupabaseClient } from '@supabase/supabase-js'
import { CODEWORDS_WORD_POOL } from '@/lib/codewords-words'
import type {
  CodewordsBoard,
  CodewordsCellType,
  CodewordsGuess,
  CodewordsPlayerRole,
  CodewordsRole,
  CodewordsTeam,
  Game,
} from '@/types'

export const CODEWORDS_MIN_PLAYERS = 4
export const CODEWORDS_MAX_PLAYERS = 12
export const CODEWORDS_DEFAULT_MAX_PLAYERS = 8
export const CODEWORDS_GRID_SIZE = 25

export function clampCodewordsMaxPlayers(value: number): number {
  return Math.min(CODEWORDS_MAX_PLAYERS, Math.max(CODEWORDS_MIN_PLAYERS, value))
}

export function codewordsMaxPlayers(game: { max_players?: number | null }): number {
  if (game.max_players == null) return CODEWORDS_DEFAULT_MAX_PLAYERS
  return clampCodewordsMaxPlayers(game.max_players)
}

export const CODEWORDS_DEFAULT_SPYMASTER_TIMER = 60
export const CODEWORDS_DEFAULT_OPERATIVE_TIMER = 60
export const CODEWORDS_TIMER_OPTIONS = [30, 45, 60, 90, 120] as const

export function clampCodewordsTimer(value: number): number {
  return CODEWORDS_TIMER_OPTIONS.includes(value as (typeof CODEWORDS_TIMER_OPTIONS)[number])
    ? value
    : CODEWORDS_DEFAULT_SPYMASTER_TIMER
}

export function turnDeadline(secondsFromNow: number): string {
  return new Date(Date.now() + secondsFromNow * 1000).toISOString()
}

export function secondsUntilDeadline(deadline: string | null | undefined): number {
  if (!deadline) return 0
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000))
}

export function isTurnExpired(deadline: string | null | undefined): boolean {
  if (!deadline) return false
  return new Date(deadline).getTime() <= Date.now()
}

export function cluePhaseUpdate(team: CodewordsTeam, spymasterSeconds: number) {
  return {
    current_turn: team,
    current_clue_word: null,
    current_clue_number: null,
    guesses_remaining: null,
    turn_phase: 'clue' as const,
    turn_deadline_at: turnDeadline(spymasterSeconds),
  }
}

export function guessPhaseUpdate(operativeSeconds: number) {
  return {
    turn_phase: 'guess' as const,
    turn_deadline_at: turnDeadline(operativeSeconds),
  }
}

export function effectiveTurnPhase(board: {
  turn_phase?: 'clue' | 'guess' | null
  current_clue_word?: string | null
}): 'clue' | 'guess' {
  if (board.turn_phase) return board.turn_phase
  return board.current_clue_word ? 'guess' : 'clue'
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function pickBoardWords(): string[] {
  return shuffle(CODEWORDS_WORD_POOL).slice(0, CODEWORDS_GRID_SIZE)
}

export function generateKey(startingTeam: CodewordsTeam): CodewordsCellType[] {
  const key: CodewordsCellType[] = Array(CODEWORDS_GRID_SIZE).fill('neutral')
  const indices = shuffle(Array.from({ length: CODEWORDS_GRID_SIZE }, (_, i) => i))
  const startingCount = 9
  const otherCount = 8
  const neutralCount = 7

  for (let i = 0; i < startingCount; i += 1) {
    key[indices[i]] = startingTeam
  }
  const otherTeam: CodewordsTeam = startingTeam === 'red' ? 'blue' : 'red'
  for (let i = startingCount; i < startingCount + otherCount; i += 1) {
    key[indices[i]] = otherTeam
  }
  for (let i = startingCount + otherCount; i < startingCount + otherCount + neutralCount; i += 1) {
    key[indices[i]] = 'neutral'
  }
  key[indices[CODEWORDS_GRID_SIZE - 1]] = 'assassin'
  return key
}

export function countTeamCells(key: CodewordsCellType[], team: CodewordsTeam): number {
  return key.filter((cell) => cell === team).length
}

export function countRevealedTeamCells(
  key: CodewordsCellType[],
  revealed: number[],
  team: CodewordsTeam
): number {
  return revealed.filter((index) => key[index] === team).length
}

export function teamWon(key: CodewordsCellType[], revealed: number[], team: CodewordsTeam): boolean {
  return countRevealedTeamCells(key, revealed, team) >= countTeamCells(key, team)
}

export function otherTeam(team: CodewordsTeam): CodewordsTeam {
  return team === 'red' ? 'blue' : 'red'
}

export function teamLabel(team: CodewordsTeam): string {
  return team === 'red' ? 'Red' : 'Blue'
}

export function roleLabel(role: CodewordsRole): string {
  return role === 'spymaster' ? 'Spymaster' : 'Operative'
}

export function waitingTurnMessage(
  board: CodewordsBoard,
  roles: Array<{ player_id: string; team: CodewordsTeam; role: CodewordsRole }>,
  playerNameById: Map<string, string>
): string {
  const phase = effectiveTurnPhase(board)
  const team = board.current_turn
  const label = teamLabel(team)

  if (phase === 'clue') {
    const spymaster = roles.find((r) => r.team === team && r.role === 'spymaster')
    const name = spymaster ? playerNameById.get(spymaster.player_id) : null
    return name
      ? `Waiting for ${name} (${label} spymaster) to give a clue`
      : `Waiting for ${label} spymaster to give a clue`
  }

  return `Waiting for ${label} operatives to guess`
}

export function guessAttributionMap(
  guesses: Array<{ cell_index: number; player_id: string }>,
  playerNameById: Map<string, string>
): Record<number, string> {
  const map: Record<number, string> = {}
  for (const guess of guesses) {
    const name = playerNameById.get(guess.player_id)
    if (name) map[guess.cell_index] = name
  }
  return map
}

export function cellColorClass(type: CodewordsCellType, revealed: boolean): string {
  if (!revealed) return 'border-[var(--border-strong)] bg-[var(--surface-inset-bg)] text-[var(--foreground)]/85'
  switch (type) {
    case 'red':
      return 'border-red-600 bg-red-200 text-red-950 dark:border-red-400 dark:bg-red-500/40 dark:text-red-50'
    case 'blue':
      return 'border-blue-600 bg-blue-200 text-blue-950 dark:border-blue-400 dark:bg-blue-500/40 dark:text-blue-50'
    case 'assassin':
      return 'border-neutral-900 bg-neutral-800 text-white dark:border-neutral-600 dark:bg-neutral-900'
    default:
      return 'border-amber-600 bg-amber-100 text-amber-950 dark:border-amber-500 dark:bg-amber-500/25 dark:text-amber-50'
  }
}

export function spymasterCellClass(type: CodewordsCellType, revealed: boolean): string {
  if (revealed) return cellColorClass(type, true)
  switch (type) {
    case 'red':
      return 'border-red-500/80 bg-red-500/15 text-red-900 dark:text-red-100'
    case 'blue':
      return 'border-blue-500/80 bg-blue-500/15 text-blue-900 dark:text-blue-100'
    case 'assassin':
      return 'border-neutral-700 bg-neutral-700/20 text-neutral-900 dark:text-neutral-200'
    default:
      return 'border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-100'
  }
}

export type CodewordsLobbyRole = {
  player_id: string
  team: CodewordsTeam
  role: CodewordsRole
}

export function lobbyReady(roles: CodewordsLobbyRole[]): { ok: boolean; error?: string } {
  const redSpymasters = roles.filter((r) => r.team === 'red' && r.role === 'spymaster')
  const blueSpymasters = roles.filter((r) => r.team === 'blue' && r.role === 'spymaster')
  const redOperatives = roles.filter((r) => r.team === 'red' && r.role === 'operative')
  const blueOperatives = roles.filter((r) => r.team === 'blue' && r.role === 'operative')

  if (redSpymasters.length !== 1) {
    return { ok: false, error: 'Red team needs exactly 1 spymaster' }
  }
  if (blueSpymasters.length !== 1) {
    return { ok: false, error: 'Blue team needs exactly 1 spymaster' }
  }
  if (redOperatives.length < 1) {
    return { ok: false, error: 'Red team needs at least 1 operative' }
  }
  if (blueOperatives.length < 1) {
    return { ok: false, error: 'Blue team needs at least 1 operative' }
  }
  return { ok: true }
}

export function lobbyTeamSummary(roles: CodewordsLobbyRole[], team: CodewordsTeam) {
  const teamRoles = roles.filter((r) => r.team === team)
  return {
    total: teamRoles.length,
    spymasters: teamRoles.filter((r) => r.role === 'spymaster').length,
    operatives: teamRoles.filter((r) => r.role === 'operative').length,
  }
}

export function mergeCodewordsGuesses(
  prev: CodewordsGuess[],
  incoming: CodewordsGuess | CodewordsGuess[]
): CodewordsGuess[] {
  const rows = Array.isArray(incoming) ? incoming : [incoming]
  const byId = new Map(prev.map((g) => [g.id, g]))
  for (const guess of rows) byId.set(guess.id, guess)
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
}

export function mergeCodewordsRoles(
  prev: CodewordsPlayerRole[],
  incoming: CodewordsPlayerRole | CodewordsPlayerRole[],
  removedId?: string
): CodewordsPlayerRole[] {
  const byPlayer = new Map(prev.map((r) => [r.player_id, r]))
  if (removedId) byPlayer.delete(removedId)
  const rows = Array.isArray(incoming) ? incoming : [incoming]
  for (const role of rows) byPlayer.set(role.player_id, role)
  return Array.from(byPlayer.values())
}

export function codewordsPlayerPicks(game: Pick<Game, 'codewords_player_picks'>): boolean {
  return game.codewords_player_picks !== false
}

export function codewordsLateJoin(game: Pick<Game, 'codewords_late_join'>): boolean {
  return game.codewords_late_join === true
}

export type CodewordsHostMode = 'spectator' | 'player'

function codewordsHostModeKey(gameCode: string) {
  return `codewords-host-mode-${gameCode.toUpperCase()}`
}

export function getCodewordsHostMode(gameCode: string): CodewordsHostMode {
  if (typeof window === 'undefined') return 'spectator'
  return localStorage.getItem(codewordsHostModeKey(gameCode)) === 'player' ? 'player' : 'spectator'
}

export function setCodewordsHostMode(gameCode: string, mode: CodewordsHostMode) {
  if (typeof window === 'undefined') return
  localStorage.setItem(codewordsHostModeKey(gameCode), mode)
}

export async function clearCodewordsSessionData(
  supabase: SupabaseClient,
  gameId: string
): Promise<{ error: string | null }> {
  const tables = ['codewords_guesses', 'codewords_boards', 'codewords_player_roles'] as const
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('game_id', gameId)
    if (error) return { error: error.message }
  }
  return { error: null }
}
