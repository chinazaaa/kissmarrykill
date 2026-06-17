'use client'

import { useRef } from 'react'
import type { Game } from '@/types'
import { bingoCallModeFromGame } from '@/lib/bingo'
import { POLL_INTERVALS, usePolling } from '@/hooks/usePolling'

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

  onSyncedRef.current = onSynced

  usePolling(
    async () => {
      if (inFlight.current) return true
      inFlight.current = true
      try {
        const res = await fetch('/api/bingo/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId: gameCode }),
        })
        if (!res.ok) return false
        onSyncedRef.current?.()
        return true
      } catch {
        return false
      } finally {
        inFlight.current = false
      }
    },
    [gameCode, game?.status, game?.bingo_call_mode],
    {
      intervalMs: POLL_INTERVALS.bingoAutoCall,
      enabled: !!enabled && !!game && game.status === 'active' && bingoCallModeFromGame(game) === 'auto',
    }
  )
}
