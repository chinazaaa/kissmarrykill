'use client'

import { useEffect, useRef } from 'react'
import { playGameFinishedSound, playRoundEndSound } from '@/lib/sounds'
import { useToast } from '@/components/ui/Toast'
import type { BingoClaim } from '@/types'

export function useBingoWinNotification({
  winner,
  winnerName,
  myPlayerId,
  enabled = true,
}: {
  winner: BingoClaim | null
  winnerName: string | null
  myPlayerId?: string | null
  enabled?: boolean
}) {
  const { info, success } = useToast()
  const readyRef = useRef(false)
  const prevWinnerIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    const winnerId = winner?.status === 'approved' ? winner.id : null

    if (!readyRef.current) {
      readyRef.current = true
      prevWinnerIdRef.current = winnerId
      return
    }

    if (winnerId && winnerId !== prevWinnerIdRef.current && winner) {
      const name = winnerName?.trim() || 'Someone'
      const iWon = !!myPlayerId && winner.player_id === myPlayerId

      if (iWon) {
        success('BINGO! You won!')
        playGameFinishedSound()
      } else {
        info(`${name} got BINGO!`)
        playRoundEndSound()
      }
    }

    prevWinnerIdRef.current = winnerId
  }, [enabled, info, myPlayerId, success, winner, winnerName])
}
