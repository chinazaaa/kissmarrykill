'use client'

import { useCallback, useState } from 'react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'

export function useHostRemovePlayer(
  gameCode: string,
  hostToken: string,
  onRemoved?: (playerId: string) => void | Promise<void>
) {
  const { confirm } = useConfirm()
  const { success, error: toastError } = useToast()
  const [removingPlayerId, setRemovingPlayerId] = useState<string | null>(null)

  const removePlayer = useCallback(
    async (playerId: string, playerName: string) => {
      if (removingPlayerId) return false
      const ok = await confirm({
        title: `Remove ${playerName}?`,
        message: 'They will be kicked from the game and can rejoin if there is room.',
        confirmLabel: 'Remove',
        destructive: true,
      })
      if (!ok) return false

      setRemovingPlayerId(playerId)
      try {
        const res = await fetch('/api/players', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameCode, playerId, hostToken }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to remove player')
        await onRemoved?.(playerId)
        success('Player removed')
        return true
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Failed to remove player')
        return false
      } finally {
        setRemovingPlayerId(null)
      }
    },
    [gameCode, hostToken, confirm, onRemoved, removingPlayerId, success, toastError]
  )

  return { removePlayer, removingPlayerId }
}
