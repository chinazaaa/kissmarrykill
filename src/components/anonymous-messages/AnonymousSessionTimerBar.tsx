'use client'

import { useAnonymousSessionTimer } from '@/hooks/useAnonymousSessionTimer'
import type { Game } from '@/types'

export function AnonymousSessionTimerBar({
  gameCode,
  game,
}: {
  gameCode: string
  game: Pick<Game, 'status' | 'session_started_at'> | null
}) {
  const { active, label, secondsLeft } = useAnonymousSessionTimer(gameCode, game)
  if (!active) return null

  const urgent = secondsLeft <= 60

  return (
    <div className={`glass-card px-4 py-3 text-center ${urgent ? 'border border-amber-500/35' : ''}`}>
      <p className="text-faint text-xs uppercase tracking-wider">Time remaining</p>
      <p className={`text-2xl font-black tabular-nums mt-1 ${urgent ? 'text-amber-300' : ''}`}>{label}</p>
      <p className="text-faint text-xs mt-1">Sessions end automatically after 15 minutes</p>
    </div>
  )
}
