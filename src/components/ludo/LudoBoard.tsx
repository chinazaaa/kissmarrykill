'use client'

import { useMemo } from 'react'
import type { LudoColor, LudoPiece, LudoPlayerState, LudoSession, Player } from '@/types'
import {
  LUDO_COLOR_HEX,
  LUDO_COLOR_LABELS,
  START_POS,
  TRACK_LENGTH,
  finishedPieceCount,
  getLegalMoves,
} from '@/lib/ludo'
import { LudoCard, LudoDice, LudoTurnBar } from '@/components/ludo/LudoChrome'

const BASE_BG: Record<LudoColor, string> = {
  red: 'bg-red-500/25 border-red-500/50',
  green: 'bg-green-500/25 border-green-500/50',
  yellow: 'bg-yellow-500/25 border-yellow-500/50',
  blue: 'bg-blue-500/25 border-blue-500/50',
}

/** 15×15 grid positions for the classic cross board (simplified layout). */
const TRACK_GRID: Record<number, { row: number; col: number }> = (() => {
  const map: Record<number, { row: number; col: number }> = {}
  // Top arm (red path going right then down)
  for (let i = 0; i < 6; i += 1) map[i] = { row: 8, col: 1 + i }
  for (let i = 0; i < 3; i += 1) map[6 + i] = { row: 7 - i, col: 6 }
  for (let i = 0; i < 6; i += 1) map[9 + i] = { row: 1 + i, col: 6 }
  // Right arm (green)
  for (let i = 0; i < 6; i += 1) map[15 + i] = { row: 6, col: 8 + i }
  for (let i = 0; i < 3; i += 1) map[21 + i] = { row: 6 + i, col: 13 }
  for (let i = 0; i < 6; i += 1) map[24 + i] = { row: 8 + i, col: 8 }
  // Bottom arm (yellow)
  for (let i = 0; i < 6; i += 1) map[30 + i] = { row: 13, col: 13 - i }
  for (let i = 0; i < 3; i += 1) map[36 + i] = { row: 13 - i, col: 8 }
  for (let i = 0; i < 6; i += 1) map[39 + i] = { row: 7 + i, col: 8 }
  // Left arm (blue)
  for (let i = 0; i < 6; i += 1) map[45 + i] = { row: 8, col: 7 - i }
  for (let i = 0; i < 3; i += 1) map[51] = { row: 8, col: 1 }
  for (let i = 0; i < 2; i += 1) map[50 - i] = { row: 9 + i, col: 1 }
  return map
})()

const HOME_GRID: Record<LudoColor, { row: number; col: number }[]> = {
  red: [
    { row: 7, col: 7 },
    { row: 6, col: 7 },
    { row: 5, col: 7 },
    { row: 4, col: 7 },
    { row: 3, col: 7 },
  ],
  green: [
    { row: 7, col: 7 },
    { row: 7, col: 8 },
    { row: 7, col: 9 },
    { row: 7, col: 10 },
    { row: 7, col: 11 },
  ],
  yellow: [
    { row: 7, col: 7 },
    { row: 8, col: 7 },
    { row: 9, col: 7 },
    { row: 10, col: 7 },
    { row: 11, col: 7 },
  ],
  blue: [
    { row: 7, col: 7 },
    { row: 7, col: 6 },
    { row: 7, col: 5 },
    { row: 7, col: 4 },
    { row: 7, col: 3 },
  ],
}

const BASE_SLOTS: Record<LudoColor, { row: number; col: number }[]> = {
  red: [
    { row: 2, col: 2 },
    { row: 2, col: 4 },
    { row: 4, col: 2 },
    { row: 4, col: 4 },
  ],
  green: [
    { row: 2, col: 10 },
    { row: 2, col: 12 },
    { row: 4, col: 10 },
    { row: 4, col: 12 },
  ],
  yellow: [
    { row: 10, col: 10 },
    { row: 10, col: 12 },
    { row: 12, col: 10 },
    { row: 12, col: 12 },
  ],
  blue: [
    { row: 10, col: 2 },
    { row: 10, col: 4 },
    { row: 12, col: 2 },
    { row: 12, col: 4 },
  ],
}

function PieceToken({
  color,
  selected,
  onClick,
  small,
}: {
  color: LudoColor
  selected?: boolean
  onClick?: () => void
  small?: boolean
}) {
  const size = small ? 'h-3 w-3' : 'h-4 w-4 sm:h-5 sm:w-5'
  const El = onClick ? 'button' : 'span'
  return (
    <El
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'rounded-full border-2 border-white/80 shadow-md transition-transform',
        size,
        selected ? 'ring-2 ring-white scale-125 z-10' : '',
        onClick ? 'cursor-pointer hover:scale-110' : '',
      ].join(' ')}
      style={{ backgroundColor: LUDO_COLOR_HEX[color] }}
    />
  )
}

export function LudoBoard({
  session,
  states,
  players,
  myPlayerId,
  onMovePiece,
  selectablePieceIds,
}: {
  session: LudoSession
  states: LudoPlayerState[]
  players: Player[]
  myPlayerId: string | null
  onMovePiece?: (pieceId: number) => void
  selectablePieceIds?: number[]
}) {
  const piecesOnBoard = useMemo(() => {
    const list: {
      color: LudoColor
      pieceId: number
      row: number
      col: number
      playerId: string
    }[] = []

    for (const row of states) {
      for (const piece of row.pieces) {
        if (piece.zone === 'base') {
          const slot = BASE_SLOTS[row.color][piece.id]
          if (slot) list.push({ color: row.color, pieceId: piece.id, row: slot.row, col: slot.col, playerId: row.player_id })
        } else if (piece.zone === 'track') {
          const grid = TRACK_GRID[piece.pos]
          if (grid) list.push({ color: row.color, pieceId: piece.id, row: grid.row, col: grid.col, playerId: row.player_id })
        } else if (piece.zone === 'home') {
          const grid = HOME_GRID[row.color][piece.pos]
          if (grid) list.push({ color: row.color, pieceId: piece.id, row: grid.row, col: grid.col, playerId: row.player_id })
        }
      }
    }
    return list
  }, [states])

  const cells: React.ReactNode[] = []
  for (let r = 0; r < 15; r += 1) {
    for (let c = 0; c < 15; c += 1) {
      let bg = 'bg-[var(--surface-inset-bg)]/40'
      let border = 'border-[var(--border)]/30'

      const isRedBase = r >= 1 && r <= 5 && c >= 1 && c <= 5
      const isGreenBase = r >= 1 && r <= 5 && c >= 9 && c <= 13
      const isYellowBase = r >= 9 && r <= 13 && c >= 9 && c <= 13
      const isBlueBase = r >= 9 && r <= 13 && c >= 1 && c <= 5
      const isCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8

      if (isRedBase) bg = BASE_BG.red
      else if (isGreenBase) bg = BASE_BG.green
      else if (isYellowBase) bg = BASE_BG.yellow
      else if (isBlueBase) bg = BASE_BG.blue
      else if (isCenter) bg = 'bg-gradient-to-br from-red-500/20 via-green-500/20 to-blue-500/20'

      const trackHere = Object.values(TRACK_GRID).some((g) => g.row === r && g.col === c)
      const startHere = Object.entries(START_POS).some(([, pos]) => {
        const g = TRACK_GRID[pos]
        return g?.row === r && g?.col === c
      })
      if (trackHere) bg = startHere ? 'bg-white/20' : 'bg-white/10'

      const herePieces = piecesOnBoard.filter((p) => p.row === r && p.col === c)

      cells.push(
        <div
          key={`${r}-${c}`}
          className={['relative border aspect-square flex items-center justify-center gap-0.5 flex-wrap p-0.5', bg, border].join(' ')}
        >
          {herePieces.map((p) => {
            const selectable = selectablePieceIds?.includes(p.pieceId) && p.playerId === myPlayerId
            return (
              <PieceToken
                key={`${p.playerId}-${p.pieceId}`}
                color={p.color}
                selected={selectable}
                small={herePieces.length > 1}
                onClick={selectable && onMovePiece ? () => onMovePiece(p.pieceId) : undefined}
              />
            )
          })}
        </div>
      )
    }
  }

  return (
    <div className="w-full max-w-[min(100%,22rem)] mx-auto">
      <div className="grid gap-0 rounded-xl overflow-hidden border-2 border-[var(--border-strong)] shadow-xl" style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}>
        {cells}
      </div>
    </div>
  )
}

export function LudoPlayerStrip({
  states,
  players,
  session,
  myPlayerId,
}: {
  states: LudoPlayerState[]
  players: Player[]
  session: LudoSession
  myPlayerId: string | null
}) {
  const turnId = session.turn_order[session.current_turn_index]

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {states.map((row) => {
        const player = players.find((p) => p.id === row.player_id)
        const isTurn = row.player_id === turnId
        const isMe = row.player_id === myPlayerId
        const finished = finishedPieceCount(row.pieces)
        return (
          <div
            key={row.player_id}
            className={[
              'rounded-lg border px-2 py-1.5 text-xs',
              isTurn ? 'border-[var(--primary)]/50 bg-[var(--primary)]/10' : 'border-[var(--border)] bg-[var(--surface-inset-bg)]/50',
            ].join(' ')}
          >
            <div className="flex items-center gap-1.5 font-semibold truncate">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: LUDO_COLOR_HEX[row.color] }} />
              <span className="truncate">{player?.name ?? 'Player'}{isMe ? ' (you)' : ''}</span>
            </div>
            <p className="text-faint mt-0.5">{finished}/4 home · {LUDO_COLOR_LABELS[row.color]}</p>
          </div>
        )
      })}
    </div>
  )
}

export function LudoGamePanel({
  session,
  states,
  players,
  myPlayerId,
  isMyTurn,
  secondsLeft,
  hasTimer,
  urgent,
  onRoll,
  onMovePiece,
  acting,
}: {
  session: LudoSession
  states: LudoPlayerState[]
  players: Player[]
  myPlayerId: string | null
  isMyTurn: boolean
  secondsLeft: number
  hasTimer: boolean
  urgent: boolean
  onRoll?: () => void
  onMovePiece?: (pieceId: number) => void
  acting?: boolean
}) {
  const turnPlayer = players.find((p) => p.id === session.turn_order[session.current_turn_index])
  const myState = states.find((s) => s.player_id === myPlayerId)

  const selectablePieceIds = useMemo(() => {
    if (!isMyTurn || session.phase !== 'move' || !myState || !session.last_dice) return []
    const moves = getLegalMoves(myState.color, myState.pieces, session.last_dice, states, myPlayerId!)
    return moves.map((m) => m.pieceId)
  }, [isMyTurn, session, myState, states, myPlayerId])

  return (
    <LudoCard className="p-3 sm:p-4 space-y-3">
      <LudoTurnBar
        turnPlayerName={turnPlayer?.name}
        isMyTurn={isMyTurn}
        secondsLeft={secondsLeft}
        hasTimer={hasTimer}
        urgent={urgent}
      />

      {session.status_message && (
        <p className="text-center text-sm text-muted">{session.status_message}</p>
      )}

      <div className="flex items-center justify-center gap-4">
        <LudoDice value={session.last_dice} />
        {session.consecutive_sixes > 0 && (
          <span className="text-xs text-amber-400 font-semibold">6s: {session.consecutive_sixes}/3</span>
        )}
      </div>

      <LudoBoard
        session={session}
        states={states}
        players={players}
        myPlayerId={myPlayerId}
        onMovePiece={isMyTurn && session.phase === 'move' ? onMovePiece : undefined}
        selectablePieceIds={selectablePieceIds}
      />

      <LudoPlayerStrip states={states} players={players} session={session} myPlayerId={myPlayerId} />

      {isMyTurn && session.phase === 'roll' && onRoll && (
        <button
          type="button"
          onClick={onRoll}
          disabled={acting}
          className="btn-primary w-full py-3 font-bold text-base"
        >
          {acting ? 'Rolling…' : 'Roll die'}
        </button>
      )}

      {isMyTurn && session.phase === 'move' && selectablePieceIds.length > 0 && (
        <p className="text-center text-xs text-muted">Tap a highlighted piece on the board to move</p>
      )}
    </LudoCard>
  )
}
