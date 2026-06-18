'use client'

import { useState, useCallback } from 'react'
import { getPlayerSession, setPlayerSession, clearPlayerSession } from '@/lib/utils'
import type { PlayerGender } from '@/types'

export function usePlayerSession(gameCode: string) {
  const [myPlayerId, setMyPlayerId] = useState<string | null>(() => {
    const session = getPlayerSession(gameCode)
    return session?.playerId ?? null
  })
  const [myPlayerName, setMyPlayerName] = useState<string | null>(() => {
    const session = getPlayerSession(gameCode)
    return session?.playerName ?? null
  })
  const [myPlayerGender, setMyPlayerGender] = useState<PlayerGender | null>(() => {
    const session = getPlayerSession(gameCode)
    return session?.playerGender ?? null
  })

  const updateSession = useCallback(
    (playerId: string, name: string, gender: PlayerGender, resumeToken?: string | null) => {
      setPlayerSession(gameCode, playerId, name, gender, resumeToken)
      setMyPlayerId(playerId)
      setMyPlayerName(name)
      setMyPlayerGender(gender)
    },
    [gameCode]
  )

  const clearSession = useCallback(() => {
    clearPlayerSession(gameCode)
    setMyPlayerId(null)
    setMyPlayerName(null)
    setMyPlayerGender(null)
  }, [gameCode])

  return {
    myPlayerId,
    myPlayerName,
    myPlayerGender,
    setMyPlayerId,
    setMyPlayerName,
    setMyPlayerGender,
    updateSession,
    clearSession,
  }
}
