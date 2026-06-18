'use client'

import { useState } from 'react'
import { resumePlayerSession } from '@/lib/player-resume'
import { normalizeResumeToken } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'

export function PlayerResumeEntry({
  gameCode,
  onResumed,
  className = '',
}: {
  gameCode: string
  onResumed: () => void | Promise<unknown>
  className?: string
}) {
  const { error: toastError, success } = useToast()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const token = normalizeResumeToken(code)
    if (token.length < 4) {
      toastError('Enter your 6-character player code')
      return
    }
    setLoading(true)
    try {
      const session = await resumePlayerSession(gameCode, token)
      if (!session) {
        toastError('Player code not found — check the code and try again')
        return
      }
      success(`Welcome back, ${session.playerName}`)
      setCode('')
      setOpen(false)
      await onResumed()
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full text-sm text-muted hover:text-body transition-colors ${className}`}
      >
        Already joined? Continue with your player code
      </button>
    )
  }

  return (
    <div className={`glass-card p-4 space-y-3 ${className}`}>
      <div className="space-y-1">
        <p className="text-muted text-xs uppercase tracking-wider">Continue your game</p>
        <p className="text-faint text-xs">Enter the player code from your other device.</p>
      </div>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === 'Enter' && void submit()}
        placeholder="Player code"
        autoFocus
        maxLength={8}
        className="input-field w-full text-center font-mono text-lg tracking-[0.2em] uppercase"
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 py-2.5 text-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || normalizeResumeToken(code).length < 4}
          className="btn-primary flex-1 py-2.5 text-sm"
        >
          {loading ? 'Checking…' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
