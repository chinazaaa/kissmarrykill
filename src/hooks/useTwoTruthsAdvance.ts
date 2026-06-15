'use client'

import { useEffect, useRef } from 'react'
import type { Game } from '@/types'

export function useTwoTruthsAdvance({
  gameCode,
  game,
  enabled = true,
  onAdvanced,
}: {
  gameCode: string
  game: Game
  enabled?: boolean
  onAdvanced?: () => void
}) {
  const inFlight = useRef(false)
  const onAdvancedRef = useRef(onAdvanced)

  useEffect(() => {
    onAdvancedRef.current = onAdvanced
  })

  useEffect(() => {
    if (!enabled || game.status !== 'active') return

    const sync = async () => {
      if (inFlight.current) return
      inFlight.current = true
      try {
        await fetch('/api/two-truths/advance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId: gameCode }),
        })
        onAdvancedRef.current?.()
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
    const id = window.setInterval(() => void sync(), 800)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, game.status, gameCode])
}
