'use client'

import { useEffect, useRef } from 'react'
import type { Game } from '@/types'
import { bingoCallModeFromGame } from '@/lib/bingo'

/** Keeps automatic bingo calling in sync — any connected client can drive calls. */
export function useBingoAutoCall({
  gameCode,
  game,
  enabled = true,
  onSynced,
}: {
  gameCode: string
  game: Game | null
  enabled?: boolean
  onSynced?: () => void
}) {
  const inFlight = useRef(false)
  const onSyncedRef = useRef(onSynced)

  useEffect(() => {
    onSyncedRef.current = onSynced
  })

  useEffect(() => {
    if (!enabled || !game || game.status !== 'active' || bingoCallModeFromGame(game) !== 'auto') return

    const sync = async () => {
      if (inFlight.current) return
      inFlight.current = true
      try {
        await fetch('/api/bingo/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId: gameCode }),
        })
        onSyncedRef.current?.()
      } catch {
        // keep polling
      } finally {
        inFlight.current = false
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync()
    }

    void sync()
    document.addEventListener('visibilitychange', onVisible)
    const id = window.setInterval(() => void sync(), 1000)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, game?.status, game?.bingo_call_mode, gameCode])
}
