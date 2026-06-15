'use client'

import {
  MONOPOLY_BOARD,
  MONOPOLY_COLOR_CLASSES,
  parsePropertyOwners,
  playerProperties,
  spaceAt,
  type MonopolyColorGroup,
} from '@/lib/monopoly'
import type { MonopolyPlayerState, Player } from '@/types'
import {
  DICE_PIPS,
  gridPositionForSpace,
  shortSpaceName,
  spaceIcon,
  tokenColorForOrder,
} from '@/components/monopoly/monopoly-ui'

function colorBar(color?: MonopolyColorGroup): string {
  if (!color) return 'bg-neutral-400/80'
  return MONOPOLY_COLOR_CLASSES[color] ?? 'bg-neutral-400'
}

function playerOrderMap(states: MonopolyPlayerState[]): Map<string, number> {
  return new Map(states.map((s) => [s.player_id, s.player_order]))
}

function playerName(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? '?'
}

function playerInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

export function MonopolyDiceFace({ value, rolling }: { value: number; rolling?: boolean }) {
  const pips = DICE_PIPS[value] ?? DICE_PIPS[1]!
  return (
    <div
      className={[
        'relative h-14 w-14 rounded-xl bg-gradient-to-br from-white to-neutral-100 shadow-lg',
        'border-2 border-neutral-200 flex items-center justify-center',
        rolling ? 'animate-pulse scale-105' : '',
      ].join(' ')}
      aria-label={`Die showing ${value}`}
    >
      <div className="grid grid-cols-3 grid-rows-3 gap-0.5 h-9 w-9">
        {Array.from({ length: 9 }, (_, i) => {
          const row = Math.floor(i / 3)
          const col = i % 3
          const show = pips.some(([r, c]) => r === row && c === col)
          return (
            <div key={i} className="flex items-center justify-center">
              {show ? <div className="h-2 w-2 rounded-full bg-neutral-900 shadow-sm" /> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function MonopolyDiceRoll({
  dice,
  rolling,
}: {
  dice: { d1: number; d2: number; doubles?: boolean } | null | undefined
  rolling?: boolean
}) {
  if (!dice) {
    return (
      <div className="flex items-center justify-center gap-3">
        <MonopolyDiceFace value={1} rolling={rolling} />
        <MonopolyDiceFace value={1} rolling={rolling} />
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-3">
        <MonopolyDiceFace value={dice.d1} rolling={rolling} />
        <MonopolyDiceFace value={dice.d2} rolling={rolling} />
      </div>
      <p className="text-sm font-bold text-emerald-100/90 tabular-nums">
        {dice.d1 + dice.d2}
        {dice.doubles ? ' · Doubles!' : ''}
      </p>
    </div>
  )
}

function BoardSpaceCell({
  spaceIndex,
  states,
  players,
  owners,
  highlightIndex,
  compact,
}: {
  spaceIndex: number
  states: MonopolyPlayerState[]
  players: Player[]
  owners: Record<string, string>
  highlightIndex?: number | null
  compact?: boolean
}) {
  const space = spaceAt(spaceIndex)
  const ownerId = owners[String(spaceIndex)]
  const orderMap = playerOrderMap(states)
  const tokens = states.filter((s) => !s.bankrupt && s.position === spaceIndex)
  const highlighted = highlightIndex === spaceIndex
  const isCorner = spaceIndex === 0 || spaceIndex === 10 || spaceIndex === 20 || spaceIndex === 30
  const icon = spaceIcon(space.type)

  return (
    <div
      className={[
        'relative flex flex-col overflow-hidden rounded-sm border bg-[#faf8f2] text-neutral-900 shadow-sm',
        'dark:bg-[#f5f0e6] transition-all duration-200',
        highlighted ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-emerald-900 z-10 scale-[1.02]' : 'border-neutral-300/80',
        isCorner ? 'min-h-[52px]' : compact ? 'min-h-[44px]' : 'min-h-[48px]',
      ].join(' ')}
    >
      {space.color ? (
        <div className={['h-2 w-full shrink-0', colorBar(space.color)].join(' ')} />
      ) : (
        <div className="h-1 shrink-0 bg-neutral-200" />
      )}
      <div className="flex flex-1 flex-col justify-between p-0.5 sm:p-1">
        <div className="flex items-start justify-between gap-0.5">
          {icon ? (
            <span className="text-[10px] sm:text-xs leading-none" aria-hidden>
              {icon}
            </span>
          ) : (
            <span className="text-[8px] font-bold text-neutral-400">#{spaceIndex}</span>
          )}
          {space.price != null && !ownerId && (
            <span className="text-[8px] sm:text-[9px] font-bold text-neutral-500">${space.price}</span>
          )}
        </div>
        <p
          className={[
            'font-bold leading-tight text-neutral-800 text-center w-full',
            isCorner ? 'text-[9px] sm:text-[10px]' : 'text-[7px] sm:text-[8px]',
          ].join(' ')}
        >
          {shortSpaceName(space.name, isCorner ? 14 : 11)}
        </p>
        {ownerId && (
          <div
            className={[
              'mx-auto mt-0.5 truncate rounded px-1 py-px text-[7px] sm:text-[8px] font-semibold max-w-full',
              tokenColorForOrder(orderMap.get(ownerId) ?? 0).bg,
              'text-white',
            ].join(' ')}
          >
            {shortSpaceName(playerName(players, ownerId), 8)}
          </div>
        )}
        {tokens.length > 0 && (
          <div className="flex flex-wrap justify-center gap-0.5 mt-0.5">
            {tokens.map((t) => {
              const c = tokenColorForOrder(t.player_order)
              return (
                <span
                  key={t.player_id}
                  className={[
                    'flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full text-[8px] font-black ring-2',
                    c.bg,
                    c.ring,
                    'text-white shadow-md',
                  ].join(' ')}
                  title={playerName(players, t.player_id)}
                >
                  {playerInitial(playerName(players, t.player_id))}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function MonopolyClassicBoard({
  states,
  players,
  propertyOwners,
  highlightIndex,
  center,
}: {
  states: MonopolyPlayerState[]
  players: Player[]
  propertyOwners: Record<string, string> | unknown
  highlightIndex?: number | null
  center?: React.ReactNode
}) {
  const owners = parsePropertyOwners(propertyOwners)

  return (
    <div className="mx-auto w-full max-w-[min(100vw-1.5rem,540px)]">
      <div
        className={[
          'relative aspect-square rounded-2xl p-1.5 sm:p-2',
          'bg-gradient-to-br from-emerald-800 via-emerald-900 to-teal-950',
          'border-[3px] border-amber-700/90 shadow-[0_20px_60px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)]',
        ].join(' ')}
      >
        <div className="grid h-full w-full grid-cols-11 grid-rows-11 gap-0.5 sm:gap-1">
          {MONOPOLY_BOARD.map((space) => {
            const { row, col } = gridPositionForSpace(space.index)
            return (
              <div
                key={space.index}
                style={{ gridRow: row + 1, gridColumn: col + 1 }}
                className="min-w-0 min-h-0"
              >
                <BoardSpaceCell
                  spaceIndex={space.index}
                  states={states}
                  players={players}
                  owners={owners}
                  highlightIndex={highlightIndex}
                  compact
                />
              </div>
            )
          })}
          <div
            className={[
              'col-start-2 col-end-11 row-start-2 row-end-11',
              'flex flex-col items-center justify-center rounded-xl',
              'bg-gradient-to-br from-emerald-700/90 to-emerald-950/95',
              'border border-emerald-600/40 shadow-inner p-3 sm:p-4 text-center',
            ].join(' ')}
          >
            {center ?? (
              <>
                <p className="text-2xl sm:text-3xl font-black tracking-tight text-amber-300 drop-shadow-sm">
                  MONOPOLY
                </p>
                <p className="text-[10px] sm:text-xs text-emerald-200/70 mt-1 uppercase tracking-[0.2em]">
                  Property Trading Game
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function MonopolyCurrentSpace({
  index,
  ownerName,
}: {
  index: number
  ownerName?: string | null
}) {
  const space = spaceAt(index)
  const icon = spaceIcon(space.type)

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f1f35] shadow-lg">
      {space.color ? (
        <div className={['h-2.5 w-full', colorBar(space.color)].join(' ')} />
      ) : (
        <div className="h-2 w-full bg-gradient-to-r from-emerald-600 to-teal-600" />
      )}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {icon && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xl">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300/80">
              You landed on
            </p>
            <p className="mt-0.5 text-xl sm:text-2xl font-black text-white leading-tight">{space.name}</p>
            {space.price != null && (
              <p className="mt-2 text-sm text-emerald-100">
                {ownerName ? (
                  <>
                    Owned by <span className="font-bold text-white">{ownerName}</span>
                    {space.rent != null ? ` · Rent $${space.rent}` : ''}
                  </>
                ) : (
                  <>
                    For sale · <span className="font-bold text-amber-400">${space.price}</span>
                    {space.rent != null ? ` · Rent $${space.rent}` : ''}
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function MonopolyMyProperties({
  playerId,
  propertyOwners,
  players,
}: {
  playerId: string
  propertyOwners: Record<string, string> | unknown
  players: Player[]
}) {
  const owners = parsePropertyOwners(propertyOwners)
  const props = playerProperties(owners, playerId)

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f1f35] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300/70 mb-3">
        My properties ({props.length})
      </p>
      {props.length === 0 ? (
        <p className="text-sm text-emerald-100/50 text-center py-3">No properties yet — start buying!</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
          {props.map((space) => (
            <div
              key={space.index}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
            >
              {space.color && (
                <span className={['h-8 w-1.5 shrink-0 rounded-full', colorBar(space.color)].join(' ')} />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{space.name}</p>
                <p className="text-[10px] text-emerald-200/60">
                  ${space.price}
                  {space.rent != null ? ` · Rent $${space.rent}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function MonopolyPlayerList({
  states,
  players,
  currentPlayerId,
  propertyOwners,
  myPlayerId,
  variant = 'dark',
}: {
  states: MonopolyPlayerState[]
  players: Player[]
  currentPlayerId?: string | null
  propertyOwners: Record<string, string> | unknown
  myPlayerId?: string | null
  variant?: 'dark' | 'light'
}) {
  const owners = parsePropertyOwners(propertyOwners)
  const dark = variant === 'dark'

  return (
    <div className="space-y-2">
      {states
        .slice()
        .sort((a, b) => a.player_order - b.player_order)
        .map((state) => {
          const player = players.find((p) => p.id === state.player_id)
          const name = player?.name ?? 'Player'
          const props = playerProperties(owners, state.player_id)
          const isTurn = state.player_id === currentPlayerId
          const isMe = state.player_id === myPlayerId
          const token = tokenColorForOrder(state.player_order)

          return (
            <div
              key={state.player_id}
              className={[
                'flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all',
                dark
                  ? isMe
                    ? 'border-sky-400/40 bg-sky-500/10 ring-1 ring-sky-400/20'
                    : isTurn
                      ? 'border-amber-400/50 bg-amber-400/10 shadow-[0_0_24px_rgba(251,191,36,0.12)]'
                      : 'border-white/10 bg-white/5'
                  : isTurn
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-[var(--border-strong)] bg-[var(--surface-inset-bg)]',
                state.bankrupt ? 'opacity-40 grayscale' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ring-2 shadow-lg',
                  token.bg,
                  token.ring,
                  'text-white',
                ].join(' ')}
              >
                {playerInitial(name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className={['font-bold truncate', dark ? 'text-white' : ''].join(' ')}>
                    {name}
                    {isMe && (
                      <span className="ml-1.5 text-xs font-normal text-sky-300">(you)</span>
                    )}
                  </p>
                  {isTurn && (
                    <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                      Turn
                    </span>
                  )}
                  {state.in_jail && (
                    <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-300">
                      Jail
                    </span>
                  )}
                  {state.bankrupt && (
                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">
                      Out
                    </span>
                  )}
                </div>
                <p className={['text-xs mt-0.5', dark ? 'text-emerald-100/60' : 'text-faint'].join(' ')}>
                  {props.length} propert{props.length === 1 ? 'y' : 'ies'} · Space {state.position}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={['text-[10px] uppercase tracking-wide', dark ? 'text-emerald-200/50' : 'text-faint'].join(' ')}>
                  Cash
                </p>
                <p className="text-lg font-black tabular-nums text-emerald-300">${state.cash.toLocaleString()}</p>
              </div>
            </div>
          )
        })}
    </div>
  )
}

/** Legacy grid — kept for fallback / compact list view */
export function MonopolyBoardGrid(props: Parameters<typeof MonopolyClassicBoard>[0]) {
  return <MonopolyClassicBoard {...props} />
}
