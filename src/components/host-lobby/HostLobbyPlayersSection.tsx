'use client'

import { HostPlayerManageList } from '@/components/host/HostPlayerManageList'
import type { Player } from '@/types'

type Props = {
  players: Player[]
  removingPlayerId?: string | null
  onRemovePlayer?: (playerId: string, playerName: string) => void
  highlightPlayerId?: string | null
  label?: string
  emptyMessage?: string
  hint?: string
  className?: string
  children?: React.ReactNode
}

export function HostLobbyPlayersSection({
  players,
  removingPlayerId,
  onRemovePlayer,
  highlightPlayerId,
  label = 'Players',
  emptyMessage,
  hint,
  className = '',
  children,
}: Props) {
  return (
    <div
      className={[
        'rounded-2xl border border-[color-mix(in_srgb,var(--primary)_14%,var(--border))]',
        'bg-[var(--card-strong)]/95 p-5 space-y-3',
        className,
      ].join(' ')}
    >
      <p className="label-caps">
        {label} — {players.length}
      </p>
      <HostPlayerManageList
        players={players}
        removingPlayerId={removingPlayerId}
        onRemovePlayer={onRemovePlayer}
        highlightPlayerId={highlightPlayerId}
        emptyMessage={emptyMessage}
        hint={hint}
      />
      {children}
    </div>
  )
}
