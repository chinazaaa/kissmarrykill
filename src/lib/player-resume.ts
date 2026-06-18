import type { PlayerGender } from '@/types'
import { parsePlayerGenderFromDb } from '@/lib/participants'
import { setPollHostMode } from '@/lib/poll-host-mode'
import {
  clearPlayerSession,
  getPlayerSession,
  normalizeResumeToken,
  setPlayerSession,
} from '@/lib/utils'

export const PLAYER_RESUME_QUERY = 'player'

export type ResolvedPlayerSession = {
  playerId: string
  playerName: string
  playerGender: PlayerGender
  resumeToken: string | null
}

type PlayerRow = {
  id: string
  name: string
  gender: string
  resume_token?: string | null
}

export function getResumeTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get(PLAYER_RESUME_QUERY)
  if (!raw?.trim()) return null
  const token = normalizeResumeToken(raw)
  return token.length >= 4 ? token : null
}

function stripResumeTokenFromUrl(): void {
  if (typeof window === 'undefined') return
  // Keep ?player= on host URLs so the combined host+play link stays shareable.
  if (window.location.pathname.startsWith('/host/')) return
  const url = new URL(window.location.href)
  if (!url.searchParams.has(PLAYER_RESUME_QUERY)) return
  url.searchParams.delete(PLAYER_RESUME_QUERY)
  const next = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState({}, '', next)
}

async function resumeFromApi(gameCode: string, resumeToken: string): Promise<ResolvedPlayerSession | null> {
  const res = await fetch('/api/players/resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameCode, resumeToken }),
  })
  const data = (await res.json()) as {
    playerId?: string
    playerName?: string
    playerGender?: string
    resumeToken?: string
    error?: string
  }
  if (!res.ok || !data.playerId || !data.playerName) return null

  const playerGender = parsePlayerGenderFromDb(data.playerGender)
  if (!playerGender) return null

  const token =
    typeof data.resumeToken === 'string' && data.resumeToken.trim()
      ? normalizeResumeToken(data.resumeToken)
      : normalizeResumeToken(resumeToken)

  setPlayerSession(gameCode, data.playerId, data.playerName, playerGender, token)
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/host/')) {
    setPollHostMode(gameCode, 'player')
  }
  stripResumeTokenFromUrl()

  return {
    playerId: data.playerId,
    playerName: data.playerName,
    playerGender,
    resumeToken: token,
  }
}

/** Restore player identity from URL code or localStorage; validates the player still exists. */
export async function resolvePlayerSession(
  gameCode: string,
  players?: PlayerRow[] | null
): Promise<ResolvedPlayerSession | null> {
  const urlToken = getResumeTokenFromUrl()
  if (urlToken) {
    const resumed = await resumeFromApi(gameCode, urlToken)
    if (resumed) return resumed
  }

  const session = getPlayerSession(gameCode)
  if (!session) return null

  if (players && !players.some((p) => p.id === session.playerId)) {
    clearPlayerSession(gameCode)
    return null
  }

  const resumeToken =
    session.resumeToken ??
    (players?.find((p) => p.id === session.playerId)?.resume_token
      ? normalizeResumeToken(players.find((p) => p.id === session.playerId)!.resume_token!)
      : null)

  if (resumeToken && resumeToken !== session.resumeToken) {
    setPlayerSession(gameCode, session.playerId, session.playerName, session.playerGender, resumeToken)
  }

  return {
    playerId: session.playerId,
    playerName: session.playerName,
    playerGender: session.playerGender,
    resumeToken,
  }
}

export async function resumePlayerSession(
  gameCode: string,
  resumeToken: string
): Promise<ResolvedPlayerSession | null> {
  const token = normalizeResumeToken(resumeToken)
  if (token.length < 4) return null
  return resumeFromApi(gameCode, token)
}

export function applyResolvedSession(
  session: ResolvedPlayerSession,
  setters: {
    setMyPlayerId: (id: string) => void
    setMyPlayerName: (name: string) => void
    setMyPlayerGender?: (gender: PlayerGender) => void
  }
): void {
  setters.setMyPlayerId(session.playerId)
  setters.setMyPlayerName(session.playerName)
  setters.setMyPlayerGender?.(session.playerGender)
}
