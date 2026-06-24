'use client'

import { checkWinner, currentTurnPlayerId, markForPlayer } from '@/lib/tic-tac-toe'
import type { Player, TicTacToeSession } from '@/types'
import { TicTacToeCard, TicTacToeTurnBar } from '@/components/tic-tac-toe/TicTacToeChrome'

function Cell({
  index,
  value,
  onClick,
  disabled,
  highlighted,
}: {
  index: number
  value: 'X' | 'O' | null
  onClick?: (index: number) => void
  disabled: boolean
  highlighted: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onClick && !value && !disabled && onClick(index)}
      disabled={disabled || !!value}
      className={[
        'aspect-square rounded-xl border-2 flex items-center justify-center text-4xl sm:text-5xl font-black transition-all',
        highlighted
          ? 'border-[var(--primary)] bg-[var(--primary)]/15'
          : 'border-[var(--border-strong)] bg-[var(--surface-inset-bg)]',
        !value && !disabled ? 'hover:bg-[var(--primary)]/10 cursor-pointer active:scale-[0.97]' : '',
        value === 'X' ? 'text-sky-500' : value === 'O' ? 'text-orange-500' : '',
      ].join(' ')}
    >
      {value === 'X' ? '✕' : value === 'O' ? '○' : ''}
    </button>
  )
}

export function TicTacToeGamePanel({
  session,
  players,
  myPlayerId,
  isMyTurn,
  secondsLeft,
  hasTimer,
  urgent,
  onMove,
  acting,
}: {
  session: TicTacToeSession
  players: Player[]
  myPlayerId: string | null
  isMyTurn: boolean
  secondsLeft: number
  hasTimer: boolean
  urgent: boolean
  onMove?: (cellIndex: number) => void
  acting?: boolean
}) {
  const turnPlayerId = currentTurnPlayerId(session)
  const turnPlayer = players.find((p) => p.id === turnPlayerId)
  const myMark = myPlayerId ? markForPlayer(session, myPlayerId) : null
  const win = checkWinner(session.board)
  const winLine = new Set(win?.line ?? [])
  const winnerName = players.find((p) => p.id === session.winner_player_id)?.name
  const playerX = players.find((p) => p.id === session.player_x_id)
  const playerO = players.find((p) => p.id === session.player_o_id)

  return (
    <div className="space-y-4">
      {session.status === 'active' && (
        <TicTacToeTurnBar
          turnPlayerName={turnPlayer?.name}
          isMyTurn={isMyTurn}
          secondsLeft={secondsLeft}
          hasTimer={hasTimer}
          urgent={urgent}
        />
      )}

      <TicTacToeCard className="p-3 flex items-center justify-between text-sm">
        <span className="font-bold text-sky-500">✕ {playerX?.name ?? 'Player 1'}</span>
        <span className="text-faint">vs</span>
        <span className="font-bold text-orange-500">○ {playerO?.name ?? 'Player 2'}</span>
      </TicTacToeCard>

      {session.status === 'finished' && (
        <TicTacToeCard className="p-4 text-center space-y-1">
          <p className="text-2xl">{win ? '🏆' : '🤝'}</p>
          <p className="text-lg font-black">{winnerName ? `${winnerName} wins!` : "It's a draw!"}</p>
        </TicTacToeCard>
      )}

      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto w-full">
        {session.board.map((value, index) => (
          <Cell
            key={index}
            index={index}
            value={value}
            onClick={onMove}
            disabled={!isMyTurn || !myMark || session.status === 'finished' || !!acting}
            highlighted={winLine.has(index)}
          />
        ))}
      </div>

      {myMark && session.status === 'active' && (
        <p className="text-center text-faint text-xs">
          You are playing as <span className="font-bold">{myMark === 'X' ? '✕' : '○'}</span>
        </p>
      )}
    </div>
  )
}
