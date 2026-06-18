'use client'

import { useState } from 'react'
import { InviteLinkActions } from '@/components/InviteLinkActions'
import { playerResumeUrl } from '@/lib/site'
import { getPlayerSession } from '@/lib/utils'

export function PlayerResumeCard({
  gameCode,
  resumeToken: resumeTokenProp,
  className = '',
  compact = false,
}: {
  gameCode: string
  resumeToken?: string | null
  className?: string
  compact?: boolean
}) {
  const resumeToken = resumeTokenProp ?? getPlayerSession(gameCode)?.resumeToken ?? null
  const [revealed, setRevealed] = useState(false)

  if (!resumeToken) return null

  const url = playerResumeUrl(gameCode, resumeToken)

  if (compact) {
    return (
      <div className={`text-center space-y-1 ${className}`}>
        <p className="text-faint text-[10px] uppercase tracking-wider">Your player code</p>
        <p className="font-mono font-bold text-sm tracking-[0.2em]">{resumeToken}</p>
      </div>
    )
  }

  return (
    <div className={`glass-card p-4 space-y-3 ${className}`}>
      <div className="space-y-1">
        <p className="text-muted text-xs uppercase tracking-wider">Continue on another device</p>
        <p className="text-faint text-xs">Save this code or link to pick up where you left off on your phone or laptop.</p>
      </div>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left"
      >
        <p className="text-faint text-[10px] uppercase tracking-wider">Your player code</p>
        <p className="font-mono font-bold text-xl tracking-[0.2em] mt-1">{revealed ? resumeToken : '••••••'}</p>
        <p className="text-faint text-xs mt-1">{revealed ? 'Tap to hide' : 'Tap to reveal'}</p>
      </button>
      <p className="text-body font-mono text-sm break-all">{url}</p>
      <InviteLinkActions url={url} copyLabel="Copy continue link" successMessage="Continue link copied" />
    </div>
  )
}
