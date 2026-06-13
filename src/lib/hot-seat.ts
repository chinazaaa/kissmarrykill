import type { Player } from '@/types'

export const HOT_SEAT_MIN_PLAYERS = 3
export const HOT_SEAT_MAX_ROUNDS_CAP = 20

/** Build a round-robin sequence of players for the hot seat. */
export function buildHotSeatSequence(players: Player[], roundCount: number): Player[] {
  if (players.length === 0) return []
  const shuffled = [...players].sort(() => Math.random() - 0.5)
  const sequence: Player[] = []
  for (let i = 0; i < roundCount; i++) {
    sequence.push(shuffled[i % shuffled.length])
  }
  return sequence
}

/** Chip options for the admin max-rounds cap (3 … 20). */
export function hotSeatMaxRoundOptions(upperBound = HOT_SEAT_MAX_ROUNDS_CAP): number[] {
  const cap = Math.min(HOT_SEAT_MAX_ROUNDS_CAP, Math.max(upperBound, HOT_SEAT_MIN_PLAYERS))
  return Array.from({ length: cap - HOT_SEAT_MIN_PLAYERS + 1 }, (_, i) => i + HOT_SEAT_MIN_PLAYERS)
}

/** Playable rounds = one turn per joined player, capped by admin max. */
export function hotSeatEffectiveRounds(joinedCount: number, maxCap: number): number {
  if (joinedCount < HOT_SEAT_MIN_PLAYERS) return 0
  const cap = Math.max(maxCap, HOT_SEAT_MIN_PLAYERS)
  return Math.min(joinedCount, cap)
}

export function hotSeatLobbyRoundsHint(joinedCount: number, maxCap: number): string {
  if (joinedCount < HOT_SEAT_MIN_PLAYERS) {
    return `Need at least ${HOT_SEAT_MIN_PLAYERS} players who claimed a name`
  }
  const effective = hotSeatEffectiveRounds(joinedCount, maxCap)
  if (effective < joinedCount) {
    return `${joinedCount} players joined → ${effective} rounds (max cap ${maxCap})`
  }
  return `${joinedCount} players joined → ${effective} rounds`
}

/** @deprecated Use hotSeatEffectiveRounds(joined, maxCap) */
export function hotSeatAutoRoundCount(playerCount: number): number {
  return hotSeatEffectiveRounds(playerCount, HOT_SEAT_MAX_ROUNDS_CAP)
}

export interface HotSeatSubmission {
  id: string
  game_id: string
  round_id: string
  player_id: string
  text: string
  submission_type: 'compliment' | 'roast' | 'observation'
  created_at: string
}
