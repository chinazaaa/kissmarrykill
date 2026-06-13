const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateGameCode(): string {
  return Array.from({ length: 6 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('')
}

export function generateToken(): string {
  return Array.from({ length: 40 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('')
}

/**
 * Generates round trios with minimal participant repetition.
 * With enough participants (>= roundCount * 3) nobody appears twice.
 * When the pool runs out it refills, pushing the most-recently-seen
 * participants to the back so repeats are spread as far apart as possible.
 */
export function generateRounds(participantIds: string[], roundCount: number): string[][] {
  if (participantIds.length < 3) return []

  const rounds: string[][] = []
  // Start with a full shuffle
  let pool = [...participantIds].sort(() => Math.random() - 0.5)

  for (let r = 0; r < roundCount; r++) {
    if (pool.length < 3) {
      // Refill: put the previous round's people at the very end
      const lastUsed = rounds[rounds.length - 1] ?? []
      const notRecent = participantIds
        .filter((id) => !lastUsed.includes(id))
        .sort(() => Math.random() - 0.5)
      const recent = lastUsed.sort(() => Math.random() - 0.5)
      pool = [...notRecent, ...recent]
    }
    rounds.push(pool.splice(0, 3))
  }

  return rounds
}

export function getPlayerSession(gameCode: string): { playerId: string; playerName: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`kmk_player_${gameCode.toUpperCase()}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setPlayerSession(gameCode: string, playerId: string, playerName: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(
    `kmk_player_${gameCode.toUpperCase()}`,
    JSON.stringify({ playerId, playerName })
  )
}

export function getInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}
