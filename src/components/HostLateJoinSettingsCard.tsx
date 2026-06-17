'use client'

import { HostAllowViewersField } from '@/components/HostAllowViewersField'
import { gameSupportsViewerSetting } from '@/lib/viewers'
import type { Game } from '@/types'

export function HostLateJoinSettingsCard({
  gameCode,
  hostToken,
  game,
  onGameUpdate,
  className = '',
}: {
  gameCode: string
  hostToken: string
  game: Game
  onGameUpdate: (game: Game) => void
  className?: string
}) {
  if (!gameSupportsViewerSetting(game.game_type)) return null
  if (game.status !== 'waiting' && game.status !== 'active') return null

  return (
    <div className={`glass-card-strong p-5 sm:p-6 space-y-3 ${className}`}>
      {game.status === 'active' && (
        <p className="text-xs text-muted leading-relaxed">
          Game in progress — you can still change whether new people may join as viewers.
        </p>
      )}
      <HostAllowViewersField
        embedded
        gameCode={gameCode}
        hostToken={hostToken}
        game={game}
        onGameUpdate={onGameUpdate}
      />
    </div>
  )
}
