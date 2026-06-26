'use client'

import { useEffect } from 'react'
import { useDeadlineCountdown } from '@/hooks/useDeadlineCountdown'
import type { Game } from '@/types'

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Whole-game countdown for Scrabble. Mirrors the Monopoly game clock: shows the
 *  time left and, once it expires, repeatedly asks the server to end the game
 *  until it actually finishes (idempotent server-side). */
export function useScrabbleGameTimer(
  gameCode: string,
  game: Pick<Game, 'status' | 'session_started_at' | 'game_duration_seconds'> | null
) {
  const duration = game?.game_duration_seconds ?? 0
  const active = game?.status === 'active' && duration > 0
  const secondsLeft = useDeadlineCountdown(game?.session_started_at, duration, active)
  const expired = active && secondsLeft <= 0

  useEffect(() => {
    if (!expired) return
    const fire = () => void fetch(`/api/games/${gameCode}/expire-scrabble`, { method: 'POST' })
    fire()
    const id = window.setInterval(fire, 5000)
    return () => window.clearInterval(id)
  }, [expired, gameCode])

  return {
    active,
    secondsLeft,
    durationSeconds: duration,
    label: formatCountdown(secondsLeft),
  }
}
