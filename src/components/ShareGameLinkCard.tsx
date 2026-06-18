'use client'

import { PlayerInviteCard } from '@/components/PlayerInviteCard'
import { PlayerResumeEntry } from '@/components/PlayerResumeEntry'
import { playerGameUrl, shareOrigin } from '@/lib/site'

type Props = {
  gameCode: string
  className?: string
  onResumed?: () => void | Promise<unknown>
}

export function ShareGameLinkCard({ gameCode, className = '', onResumed }: Props) {
  const url = playerGameUrl(gameCode, shareOrigin())
  const handleResumed = onResumed ?? (() => window.location.reload())

  return (
    <div className={`space-y-3 ${className}`}>
      <PlayerInviteCard
        url={url}
        gameCode={gameCode}
        title="Invite friends"
      />
      <PlayerResumeEntry gameCode={gameCode} onResumed={handleResumed} />
    </div>
  )
}
