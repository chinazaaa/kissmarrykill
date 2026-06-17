'use client'

import { useMemo } from 'react'
import type { LudoColor, LudoPiece, LudoPlayerState, LudoSession, Player } from '@/types'
import {
  LUDO_COLOR_HEX,
  LUDO_COLOR_LABELS,
  START_POS,
  finishedPieceCount,
  getLegalMoves,
  type LudoMoveOption,
} from '@/lib/ludo'
import {
  BASE_SLOTS,
  HOME_GRID,
  TRACK_GRID,
  moveDestinationCell,
  pieceStatusLabel,
} from '@/lib/ludo-board-layout'
import { LudoCard, LudoDice, LudoTurnBar } from '@/components/ludo/LudoChrome'

const BASE_BG: Record<LudoColor, string> = {
  red: 'bg-red-500/25 border-red-500/50',
  green: 'bg-green-500/25 border-green-500/50',
  yellow: 'bg-yellow-500/25 border-yellow-500/50',
  blue: 'bg-blue-500/25 border-blue-500/50',
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
  highlightCells,
}: {
  session: LudoSession
  states: LudoPlayerState[]
  players: Player[]
  myPlayerId: string | null
  onMovePiece?: (pieceId: number) => void
  selectablePieceIds?: number[]
  highlightCells?: Set<string>
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
        } else if (piece.zone === 'finished') {
          list.push({ color: row.color, pieceId: piece.id, row: 7, col: 7, playerId: row.player_id })
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
      const isHighlight = highlightCells?.has(`${r},${c}`)

      cells.push(
        <div
          key={`${r}-${c}`}
          className={[
            'relative border aspect-square flex items-center justify-center gap-0.5 flex-wrap p-0.5',
            bg,
            border,
            isHighlight ? 'ring-2 ring-[var(--primary)]/70 bg-[var(--primary)]/20' : '',
          ].join(' ')}
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
  rolling,
  displayDice,
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
  rolling?: boolean
  displayDice?: number | null
}) {
  const turnPlayer = players.find((p) => p.id === session.turn_order[session.current_turn_index])
  const myState = states.find((s) => s.player_id === myPlayerId)

  const legalMoves = useMemo((): LudoMoveOption[] => {
    if (!isMyTurn || session.phase !== 'move' || !myState || !session.last_dice || !myPlayerId) return []
    return getLegalMoves(myState.color, myState.pieces, session.last_dice, states, myPlayerId)
  }, [isMyTurn, session, myState, states, myPlayerId])

  const selectablePieceIds = legalMoves.map((m) => m.pieceId)

  const highlightCells = useMemo(() => {
    if (!myState || legalMoves.length === 0) return undefined
    const cells = new Set<string>()
    for (const move of legalMoves) {
      const cell = moveDestinationCell(myState.color, move.to)
      if (cell) cells.add(`${cell.row},${cell.col}`)
    }
    return cells
  }, [legalMoves, myState])

  const diceValue = displayDice ?? session.last_dice

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
        <LudoDice value={diceValue} rolling={rolling} />
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
        highlightCells={highlightCells}
      />

      <LudoPlayerStrip states={states} players={players} session={session} myPlayerId={myPlayerId} />

      {isMyTurn && session.phase === 'roll' && onRoll && (
        <button
          type="button"
          onClick={onRoll}
          disabled={acting || rolling}
          className="btn-primary w-full py-3 font-bold text-base"
        >
          {acting || rolling ? 'Rolling…' : 'Roll die'}
        </button>
      )}

      {isMyTurn && session.phase === 'move' && legalMoves.length > 0 && onMovePiece && (
        <div className="space-y-2">
          <p className="text-center text-xs font-semibold text-muted">Choose a piece to move</p>
          <div className="grid grid-cols-2 gap-2">
            {legalMoves.map((move) => {
              const fromLabel = pieceStatusLabel(move.from)
              const toLabel =
                move.to.zone === 'finished'
                  ? 'Home!'
                  : move.to.zone === 'home'
                    ? `Home ${move.to.pos + 1}`
                    : move.to.zone === 'track'
                      ? `Square ${move.to.pos + 1}`
                      : 'Start'
              return (
                <button
                  key={move.pieceId}
                  type="button"
                  disabled={acting}
                  onClick={() => onMovePiece(move.pieceId)}
                  className="rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-3 py-2 text-left text-xs font-semibold hover:bg-[var(--primary)]/20 disabled:opacity-50"
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-3 rounded-full border border-white/70"
                      style={{ backgroundColor: myState ? LUDO_COLOR_HEX[myState.color] : undefined }}
                    />
                    Piece {move.pieceId + 1}
                  </span>
                  <span className="mt-0.5 block text-faint font-normal">
                    {fromLabel} → {toLabel}
                    {move.captures ? ' · Capture!' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {isMyTurn && session.phase === 'roll' && !rolling && (
        <p className="text-center text-xs text-faint">You need a 6 to bring pieces onto the board</p>
      )}
    </LudoCard>
  )
}
