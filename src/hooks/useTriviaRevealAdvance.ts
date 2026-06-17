'use client'

import { useRef } from 'react'
import type { Game } from '@/types'
import { POLL_INTERVALS, usePolling } from '@/hooks/usePolling'

/** Polls server sync so rounds auto-end and advance even if the host tab is backgrounded. */
export function useTriviaRevealAdvance({
  gameCode,
  game,
  enabled = true,
  onAdvanced,
}: {
  gameCode: string
  game: Game
  rounds?: unknown
  enabled?: boolean
  onAdvanced?: () => void
}) {
  const inFlight = useRef(false)
  const onAdvancedRef = useRef(onAdvanced)

  onAdvancedRef.current = onAdvanced

  usePolling(
    async () => {
      if (inFlight.current) return true
      inFlight.current = true
      try {
        const res = await fetch('/api/trivia/advance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId: gameCode }),
        })
        if (!res.ok) return false
        onAdvancedRef.current?.()
        return true
      } catch {
        return false
      } finally {
        inFlight.current = false
      }
    },
    [gameCode, game.status],
    { intervalMs: POLL_INTERVALS.advanceSync, enabled: !!enabled && game.status === 'active' }
  )
}
