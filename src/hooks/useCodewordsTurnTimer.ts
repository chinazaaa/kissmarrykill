'use client'

import { useEffect, useRef, useState } from 'react'
import { isTurnExpired, secondsUntilDeadline } from '@/lib/codewords'
import type { CodewordsBoard } from '@/types'

export function useCodewordsTurnTimer(gameCode: string, board: CodewordsBoard | null, enabled: boolean) {
  const [secondsLeft, setSecondsLeft] = useState(0)
  const expiringRef = useRef(false)

  useEffect(() => {
    if (!enabled || !board?.turn_deadline_at || board.winner) {
      setSecondsLeft(0)
      return
    }

    const tick = async () => {
      const left = secondsUntilDeadline(board.turn_deadline_at)
      setSecondsLeft(left)

      if (isTurnExpired(board.turn_deadline_at) && !expiringRef.current) {
        expiringRef.current = true
        try {
          await fetch('/api/codewords/expire-turn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId: gameCode }),
          })
        } finally {
          expiringRef.current = false
        }
      }
    }

    tick()
    const id = window.setInterval(() => {
      void tick()
    }, 1000)
    return () => window.clearInterval(id)
  }, [board, enabled, gameCode])

  return { secondsLeft, urgent: secondsLeft > 0 && secondsLeft <= 10 }
}
