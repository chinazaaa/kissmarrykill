'use client'

import { useCallback, useEffect, useState } from 'react'
import { parsePlayerGenderFromDb } from '@/lib/participants'
import { supabase } from '@/lib/supabase'
import { getPlayerSession, setPlayerSession } from '@/lib/utils'

const SESSION_EVENT = 'kmk-player-session'

export function useHostPlayerSession(gameCode: string | null) {
  const [resumeToken, setResumeToken] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!gameCode) {
      setResumeToken(null)
      setPlayerName(null)
      return
    }

    const session = getPlayerSession(gameCode)
    if (!session?.playerId) {
      setResumeToken(null)
      setPlayerName(null)
      return
    }

    setPlayerName(session.playerName)

    if (session.resumeToken) {
      setResumeToken(session.resumeToken)
      return
    }

    const { data: player } = await supabase
      .from('players')
      .select('resume_token, name, gender')
      .eq('id', session.playerId)
      .eq('game_id', gameCode.toUpperCase())
      .maybeSingle()

    if (player?.resume_token) {
      const gender = parsePlayerGenderFromDb(player.gender)
      if (gender) {
        setPlayerSession(gameCode, session.playerId, player.name, gender, player.resume_token)
        setResumeToken(player.resume_token)
      }
      return
    }

    setResumeToken(null)
  }, [gameCode])

  useEffect(() => {
    void refresh()
    const onSession = (event: Event) => {
      const detail = (event as CustomEvent<{ gameCode?: string }>).detail
      if (!detail?.gameCode || detail.gameCode === gameCode?.toUpperCase()) {
        void refresh()
      }
    }
    window.addEventListener(SESSION_EVENT, onSession)
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener(SESSION_EVENT, onSession)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [gameCode, refresh])

  return { resumeToken, playerName }
}
