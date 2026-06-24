'use client'

import { useEffect, useRef } from 'react'
import { useDeadlineCountdown } from '@/hooks/useDeadlineCountdown'
import { wordHuntTimerSeconds } from '@/lib/word-hunt'
import type { Game } from '@/types'

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function useWordHuntGameTimer(
  gameCode: string,
  game: Pick<Game, 'status' | 'session_started_at' | 'timer_seconds'> | null
) {
  const duration = wordHuntTimerSeconds(game?.timer_seconds)
  const active = game?.status === 'active' && !!game.session_started_at
  const secondsLeft = useDeadlineCountdown(game?.session_started_at, duration, active)
  const expiredRef = useRef(false)

  useEffect(() => {
    expiredRef.current = false
  }, [game?.session_started_at, duration, game?.status])

  useEffect(() => {
    if (!active || secondsLeft > 0 || expiredRef.current) return
    expiredRef.current = true
    void fetch(`/api/games/${gameCode}/expire-word-hunt`, { method: 'POST' })
  }, [active, secondsLeft, gameCode])

  return {
    active,
    secondsLeft,
    durationSeconds: duration,
    timeUp: active && secondsLeft <= 0,
    label: formatCountdown(secondsLeft),
  }
}
