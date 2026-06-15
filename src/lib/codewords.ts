import type { SupabaseClient } from '@supabase/supabase-js'
import { CODEWORDS_WORD_POOL } from '@/lib/codewords-words'
import type { CodewordsCellType, CodewordsRole, CodewordsTeam } from '@/types'

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

export async function clearCodewordsSessionData(
  supabase: SupabaseClient,
  gameId: string
): Promise<{ error: string | null }> {
  const tables = ['codewords_boards', 'codewords_player_roles'] as const
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('game_id', gameId)
    if (error) return { error: error.message }
  }
  return { error: null }
}
