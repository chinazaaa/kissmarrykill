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

export function generateRounds(participantIds: string[], roundCount: number): string[][] {
  if (participantIds.length < 3) return []
  const rounds: string[][] = []
  for (let i = 0; i < roundCount; i++) {
    const shuffled = [...participantIds].sort(() => Math.random() - 0.5)
    rounds.push(shuffled.slice(0, 3))
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
  localStorage.setItem(`kmk_player_${gameCode.toUpperCase()}`, JSON.stringify({ playerId, playerName }))
}

export function getInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}
