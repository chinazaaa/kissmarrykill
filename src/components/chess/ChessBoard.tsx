'use client'

import { useMemo, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { colorForPlayer, currentTurnPlayerId } from '@/lib/chess'
import type { ChessColor, Player, ChessSession } from '@/types'
import { ChessCard, ChessTurnBar } from '@/components/chess/ChessChrome'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const

const GLYPH: Record<string, string> = {
  p: '♟',
  r: '♜',
  n: '♞',
  b: '♝',
  q: '♛',
  k: '♚',
}

const PROMOTION_PIECES: { piece: 'q' | 'r' | 'b' | 'n'; label: string }[] = [
  { piece: 'q', label: '♛ Queen' },
  { piece: 'r', label: '♜ Rook' },
  { piece: 'b', label: '♝ Bishop' },
  { piece: 'n', label: '♞ Knight' },
]

function Piece({ type, color }: { type: string; color: ChessColor }) {
  return (
    <span
      className="select-none leading-none text-[7.5vw] sm:text-[2.4rem]"
      style={{
        color: color === 'w' ? '#f8fafc' : '#1e293b',
        textShadow:
          color === 'w'
            ? '0 0 1px #0f172a, 0 1px 2px rgba(0,0,0,0.45)'
            : '0 0 1px #f8fafc, 0 1px 2px rgba(0,0,0,0.35)',
      }}
    >
      {GLYPH[type]}
    </span>
  )
}

export function ChessGamePanel({
  session,
  players,
  myPlayerId,
  isMyTurn,
  secondsLeft,
  hasTimer,
  urgent,
  onMove,
  onResign,
  acting,
}: {
  session: ChessSession
  players: Player[]
  myPlayerId: string | null
  isMyTurn: boolean
  secondsLeft: number
  hasTimer: boolean
  urgent: boolean
  onMove?: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => void
  onResign?: () => void
  acting?: boolean
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)

  const myColor = myPlayerId ? colorForPlayer(session, myPlayerId) : null
  const flip = myColor === 'b'
  const finished = session.status === 'finished'
  const interactive = !!onMove && isMyTurn && !finished && !acting && !!myColor

  const chess = useMemo(() => {
    const c = new Chess()
    try {
      c.load(session.fen)
    } catch {
      // leave at starting position if the FEN is somehow invalid
    }
    return c
  }, [session.fen])

  const legalTargets = useMemo(() => {
    if (!selected || !interactive) return new Map<string, { promotion: boolean }>()
    const map = new Map<string, { promotion: boolean }>()
    try {
      for (const m of chess.moves({ square: selected as Square, verbose: true })) {
        const prev = map.get(m.to)
        map.set(m.to, { promotion: (prev?.promotion ?? false) || m.flags.includes('p') })
      }
    } catch {
      // invalid square — ignore
    }
    return map
  }, [chess, selected, interactive])

  const checkSquare = useMemo(() => {
    if (!chess.inCheck()) return null
    for (const row of chess.board()) {
      for (const cell of row) {
        if (cell && cell.type === 'k' && cell.color === chess.turn()) return cell.square
      }
    }
    return null
  }, [chess])

  const orderedRanks = flip ? [...RANKS].reverse() : RANKS
  const orderedFiles = flip ? [...FILES].reverse() : FILES

  const turnPlayer = players.find((p) => p.id === currentTurnPlayerId(session))
  const white = players.find((p) => p.id === session.player_white_id)
  const black = players.find((p) => p.id === session.player_black_id)
  const winnerName = players.find((p) => p.id === session.winner_player_id)?.name

  const handleSquareClick = (square: string) => {
    if (!interactive) return
    const piece = chess.get(square as Square)

    if (selected) {
      const target = legalTargets.get(square)
      if (target) {
        if (target.promotion) {
          setPendingPromotion({ from: selected, to: square })
        } else {
          onMove?.(selected, square)
          setSelected(null)
        }
        return
      }
    }

    if (piece && piece.color === myColor) {
      setSelected(square)
      setPendingPromotion(null)
    } else {
      setSelected(null)
    }
  }

  const confirmPromotion = (piece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return
    onMove?.(pendingPromotion.from, pendingPromotion.to, piece)
    setPendingPromotion(null)
    setSelected(null)
  }

  return (
    <div className="space-y-4">
      {session.status === 'active' && (
        <ChessTurnBar
          turnPlayerName={turnPlayer?.name}
          isMyTurn={isMyTurn}
          secondsLeft={secondsLeft}
          hasTimer={hasTimer}
          urgent={urgent}
          inCheck={session.in_check}
        />
      )}

      <ChessCard className="p-3 flex items-center justify-between text-sm">
        <span className="font-bold">♔ {white?.name ?? 'White'}</span>
        <span className="text-faint">vs</span>
        <span className="font-bold">♚ {black?.name ?? 'Black'}</span>
      </ChessCard>

      {finished && (
        <ChessCard className="p-4 text-center space-y-1">
          <p className="text-2xl">{session.is_draw ? '🤝' : '🏆'}</p>
          <p className="text-lg font-black">{winnerName ? `${winnerName} wins!` : "It's a draw!"}</p>
          {session.result_reason && (
            <p className="text-xs text-faint capitalize">{session.result_reason.replace('_', ' ')}</p>
          )}
        </ChessCard>
      )}

      <div className="max-w-md mx-auto w-full">
        <div className="grid grid-cols-8 rounded-lg overflow-hidden border-2 border-[var(--border-strong)] shadow-lg">
          {orderedRanks.map((rank) =>
            orderedFiles.map((file) => {
              const square = `${file}${rank}`
              const piece = chess.get(square as Square)
              const isLight = (FILES.indexOf(file) + rank) % 2 === 1
              const target = legalTargets.get(square)
              const isSelected = selected === square
              const isLastMove = session.last_move_from === square || session.last_move_to === square
              const isCheck = checkSquare === square

              return (
                <button
                  key={square}
                  type="button"
                  onClick={() => handleSquareClick(square)}
                  disabled={!interactive}
                  className={[
                    'relative aspect-square flex items-center justify-center',
                    isLight ? 'bg-[#eed9b5]' : 'bg-[#b58863]',
                    interactive ? 'cursor-pointer' : 'cursor-default',
                  ].join(' ')}
                >
                  {isLastMove && <span className="absolute inset-0 bg-yellow-300/40" />}
                  {isCheck && <span className="absolute inset-0 bg-rose-500/50" />}
                  {isSelected && <span className="absolute inset-0 ring-2 ring-inset ring-[var(--primary)]" />}
                  {piece && <Piece type={piece.type} color={piece.color} />}
                  {target && !piece && (
                    <span className="absolute w-1/4 h-1/4 rounded-full bg-black/30" />
                  )}
                  {target && piece && (
                    <span className="absolute inset-1 rounded-full ring-4 ring-black/30" />
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {pendingPromotion && (
        <ChessCard className="p-3 space-y-2">
          <p className="text-center text-sm font-bold">Promote to…</p>
          <div className="grid grid-cols-4 gap-2">
            {PROMOTION_PIECES.map(({ piece, label }) => (
              <button
                key={piece}
                type="button"
                onClick={() => confirmPromotion(piece)}
                className="rounded-lg border-2 border-[var(--border-strong)] py-2 text-sm font-bold hover:bg-[var(--primary)]/10"
              >
                {label}
              </button>
            ))}
          </div>
        </ChessCard>
      )}

      {myColor && session.status === 'active' && (
        <div className="space-y-2">
          <p className="text-center text-faint text-xs">
            You are <span className="font-bold">{myColor === 'w' ? '♔ White' : '♚ Black'}</span>
            {isMyTurn ? ' · tap a piece, then its destination' : ' · waiting for your opponent'}
          </p>
          {onResign && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onResign}
                disabled={!!acting}
                className="rounded-lg border-2 border-[var(--border-strong)] px-6 py-2 text-sm font-semibold text-muted hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
              >
                Resign
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
