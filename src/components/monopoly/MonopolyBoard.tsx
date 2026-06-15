'use client'

import {
  MONOPOLY_BOARD,
  MONOPOLY_COLOR_CLASSES,
  parsePropertyOwners,
  spaceAt,
  type MonopolyColorGroup,
} from '@/lib/monopoly'
import type { MonopolyPlayerState, Player } from '@/types'

function colorBar(color?: MonopolyColorGroup): string {
  if (!color) return 'bg-neutral-300'
  return MONOPOLY_COLOR_CLASSES[color] ?? 'bg-neutral-400'
}

export function MonopolyBoardGrid({
  states,
  players,
  propertyOwners,
  highlightIndex,
}: {
  states: MonopolyPlayerState[]
  players: Player[]
  propertyOwners: Record<string, string> | unknown
  highlightIndex?: number | null
}) {
  const owners = parsePropertyOwners(propertyOwners)
  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? '?'

  const tokensAt = (index: number) =>
    states
      .filter((s) => !s.bankrupt && s.position === index)
      .map((s) => playerName(s.player_id))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-[420px] overflow-y-auto pr-1">
      {MONOPOLY_BOARD.map((space) => {
        const ownerId = owners[String(space.index)]
        const tokens = tokensAt(space.index)
        const highlighted = highlightIndex === space.index
        return (
          <div
            key={space.index}
            className={[
              'rounded-lg border text-left overflow-hidden min-h-[72px] flex flex-col',
              highlighted
                ? 'border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-500/10'
                : 'border-[var(--border-strong)] bg-[var(--surface-inset-bg)]',
            ].join(' ')}
          >
            {space.color && <div className={['h-1.5 w-full', colorBar(space.color)].join(' ')} />}
            <div className="p-2 flex-1 flex flex-col gap-1">
              <div className="text-[10px] font-bold uppercase text-faint">#{space.index}</div>
              <div className="text-xs font-semibold leading-tight line-clamp-2">{space.name}</div>
              {space.price != null && !ownerId && (
                <div className="text-[10px] text-faint">${space.price}</div>
              )}
              {ownerId && (
                <div className="text-[10px] text-emerald-600 dark:text-emerald-300 truncate">
                  {playerName(ownerId)}
                </div>
              )}
              {tokens.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-auto">
                  {tokens.map((t) => (
                    <span
                      key={t}
                      className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-200"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function MonopolyCurrentSpace({ index }: { index: number }) {
  const space = spaceAt(index)
  return (
    <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-inset-bg)] overflow-hidden">
      {space.color && <div className={['h-2 w-full', colorBar(space.color)].join(' ')} />}
      <div className="p-4">
        <p className="text-faint text-xs uppercase tracking-wide">Current space</p>
        <p className="text-xl font-black mt-1">{space.name}</p>
        {space.price != null && (
          <p className="text-sm text-muted mt-1">
            Price ${space.price}
            {space.rent != null ? ` · Rent $${space.rent}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

export function MonopolyPlayerList({
  states,
  players,
  currentPlayerId,
  propertyOwners,
}: {
  states: MonopolyPlayerState[]
  players: Player[]
  currentPlayerId?: string | null
  propertyOwners: Record<string, string> | unknown
}) {
  const owners = parsePropertyOwners(propertyOwners)

  return (
    <div className="space-y-2">
      {states
        .slice()
        .sort((a, b) => a.player_order - b.player_order)
        .map((state) => {
          const player = players.find((p) => p.id === state.player_id)
          const propCount = Object.values(owners).filter((id) => id === state.player_id).length
          const isTurn = state.player_id === currentPlayerId
          return (
            <div
              key={state.player_id}
              className={[
                'flex items-center justify-between rounded-xl border px-3 py-2.5',
                isTurn
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-[var(--border-strong)] bg-[var(--surface-inset-bg)]',
                state.bankrupt ? 'opacity-50' : '',
              ].join(' ')}
            >
              <div>
                <p className="font-bold text-sm">
                  {player?.name ?? 'Player'}
                  {isTurn && <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-300">Turn</span>}
                  {state.in_jail && <span className="ml-2 text-xs text-amber-600">In jail</span>}
                  {state.bankrupt && <span className="ml-2 text-xs text-red-500">Bankrupt</span>}
                </p>
                <p className="text-xs text-faint">{propCount} properties · Space {state.position}</p>
              </div>
              <p className="font-black text-emerald-600 dark:text-emerald-300">${state.cash}</p>
            </div>
          )
        })}
    </div>
  )
}
