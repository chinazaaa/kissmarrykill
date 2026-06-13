export type VoteCategory = 'kiss' | 'marry' | 'smash'

export interface RoundTally {
  id: string
  kiss: number
  marry: number
  smash: number
}

type VoteRow = {
  kiss_participant_id: string | null
  marry_participant_id: string | null
  kill_participant_id: string | null
}

export function tallyRoundVotes(participantIds: string[], votes: VoteRow[]): RoundTally[] {
  return participantIds.map((id) => ({
    id,
    kiss: votes.filter((v) => v.kiss_participant_id === id).length,
    marry: votes.filter((v) => v.marry_participant_id === id).length,
    smash: votes.filter((v) => v.kill_participant_id === id).length,
  }))
}

export function maxInRound(tallies: RoundTally[]): Record<VoteCategory, number> {
  return {
    kiss: Math.max(1, ...tallies.map((t) => t.kiss)),
    marry: Math.max(1, ...tallies.map((t) => t.marry)),
    smash: Math.max(1, ...tallies.map((t) => t.smash)),
  }
}

export function isCategoryWinner(tallies: RoundTally[], participantId: string, category: VoteCategory): boolean {
  const max = Math.max(...tallies.map((t) => t[category]))
  if (max === 0) return false
  const tally = tallies.find((t) => t.id === participantId)
  return tally?.[category] === max
}

export function winnerNames(
  tallies: RoundTally[],
  category: VoteCategory,
  nameById: Map<string, string>
): string[] {
  const max = Math.max(...tallies.map((t) => t[category]))
  if (max === 0) return []
  return tallies
    .filter((t) => t[category] === max)
    .map((t) => nameById.get(t.id) ?? '')
    .filter(Boolean)
}

export const VOTE_CATEGORY_META: Record<
  VoteCategory,
  { emoji: string; label: string; color: string }
> = {
  kiss: { emoji: '❤️', label: 'Kiss', color: '#f472b6' },
  marry: { emoji: '💍', label: 'Marry', color: '#fbbf24' },
  smash: { emoji: '💀', label: 'Smash', color: '#f87171' },
}
