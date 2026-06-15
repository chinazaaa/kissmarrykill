'use client'

import { useState } from 'react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'

export function CodewordsLeaveButton({
  gameCode,
  playerId,
  onLeft,
  className = 'btn-secondary w-full',
}: {
  gameCode: string
  playerId: string
  onLeft: () => void
  className?: string
}) {
  const { confirm } = useConfirm()
  const { error: toastError } = useToast()
  const [leaving, setLeaving] = useState(false)

  const leaveGame = async () => {
    if (leaving) return
    const ok = await confirm({
      title: 'Leave this game?',
      message: 'You can rejoin with the same name if there is room.',
      confirmLabel: 'Leave',
      destructive: true,
    })
    if (!ok) return

    setLeaving(true)
    try {
      const res = await fetch('/api/players', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameCode, playerId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to leave')
      onLeft()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to leave')
    } finally {
      setLeaving(false)
    }
  }

  return (
    <button type="button" onClick={() => void leaveGame()} disabled={leaving} className={className}>
      {leaving ? 'Leaving…' : 'Leave game'}
    </button>
  )
}
