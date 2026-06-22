'use client'

import type { Player } from '@/types'

export function HostPlayerManageList({
  players,
  removingPlayerId,
  onRemovePlayer,
  highlightPlayerId,
  emptyMessage = 'Waiting for players…',
  hint = 'Remove to kick someone out',
  className = '',
  compact = false,
}: {
  players: Player[]
  removingPlayerId?: string | null
  onRemovePlayer?: (playerId: string, playerName: string) => void
  highlightPlayerId?: string | null
  emptyMessage?: string
  hint?: string
  className?: string
  compact?: boolean
}) {
  if (players.length === 0) {
    return <p className="text-muted text-sm">{emptyMessage}</p>
  }

  const showReady = players.some((p) => p.spectator === true)

  return (
    <div className={`space-y-2 ${className}`}>
      {hint && onRemovePlayer && <p className="text-faint text-xs">{hint}</p>}
      <ul className={compact ? 'space-y-1' : 'space-y-1.5'}>
        {players.map((p) => {
          const ready = p.spectator !== true
          return (
            <li
              key={p.id}
              className={
                compact
                  ? 'flex items-center justify-between gap-2 text-sm'
                  : 'flex items-center justify-between gap-2 rounded-xl border border-[var(--border-strong)] px-3 py-2'
              }
            >
              <span className="font-medium text-sm truncate min-w-0">{p.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                {showReady && (
                  <span className={`text-sm font-bold ${ready ? 'text-emerald-500' : 'text-red-400'}`}>
                    {ready ? '✓' : '✗'}
                  </span>
                )}
                {highlightPlayerId === p.id && (
                  <span className="text-[10px] font-bold uppercase text-[var(--primary)]">You</span>
                )}
                {onRemovePlayer && (
                  <button
                    type="button"
                    onClick={() => onRemovePlayer(p.id, p.name)}
                    disabled={removingPlayerId === p.id}
                    className="text-faint hover:text-red-400 text-xs disabled:opacity-50 transition-colors"
                  >
                    {removingPlayerId === p.id ? '…' : 'Remove'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
