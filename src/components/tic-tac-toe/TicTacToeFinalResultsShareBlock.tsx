'use client'

import { useRef, type ReactNode } from 'react'
import type { Game, Player, TicTacToeSession } from '@/types'
import { checkWinner } from '@/lib/tic-tac-toe'
import { HostGameFinishedActions } from '@/components/host/HostGameFinishedActions'
import { ShareResultsCaptureHeader } from '@/components/ShareResultsCaptureHeader'
import { ShareResults } from '@/components/ShareResults'

function ReadOnlyBoard({ board }: { board: (string | null)[] }) {
  const win = checkWinner(board as ('X' | 'O' | null)[])
  const winLine = new Set(win?.line ?? [])

  return (
    <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto w-full">
      {board.map((value, index) => (
        <div
          key={index}
          className={[
            'aspect-square rounded-xl border-2 flex items-center justify-center text-3xl sm:text-4xl font-black',
            winLine.has(index)
              ? 'border-[var(--primary)] bg-[var(--primary)]/15'
              : 'border-[var(--border-strong)] bg-[var(--surface-inset-bg)]',
            value === 'X' ? 'text-sky-500' : value === 'O' ? 'text-orange-500' : '',
          ].join(' ')}
        >
          {value === 'X' ? '✕' : value === 'O' ? '○' : ''}
        </div>
      ))}
    </div>
  )
}

export function TicTacToeFinalResultsShareBlock({
  game,
  players,
  session,
  winnerName,
  highlightPlayerId,
  playAgainButton,
}: {
  game: Game
  players: Player[]
  session: TicTacToeSession | null
  winnerName?: string | null
  highlightPlayerId?: string | null
  playAgainButton?: ReactNode
}) {
  const captureRef = useRef<HTMLDivElement>(null)

  const playerX = players.find((p) => p.id === session?.player_x_id)
  const playerO = players.find((p) => p.id === session?.player_o_id)
  const winnerPlayerId = session?.winner_player_id ?? null
  const displayWinner =
    winnerName ?? (winnerPlayerId ? players.find((p) => p.id === winnerPlayerId)?.name : null) ?? null
  const isDraw = session?.is_draw === true
  const endedEarly = game.status === 'finished' && !displayWinner && !isDraw

  return (
    <div className="space-y-4">
      <div ref={captureRef} className="glass-card-strong p-6 sm:p-8 space-y-4">
        <ShareResultsCaptureHeader game={game} />
        <p className="text-5xl sm:text-6xl leading-none text-center pt-1">{isDraw ? '🤝' : endedEarly ? '🏁' : '🏆'}</p>
        <p className="text-xl sm:text-2xl font-black text-center text-[var(--marry)]">
          {isDraw ? "It's a draw!" : displayWinner ? `${displayWinner} wins!` : endedEarly ? 'Game ended early' : 'Game over'}
        </p>
        {session && (
          <>
            <div className="flex items-center justify-between gap-3 text-sm px-1">
              <span className="font-bold text-sky-500 truncate">
                ✕ {playerX?.name ?? 'Player 1'}
                {playerX?.id === highlightPlayerId ? ' (you)' : ''}
              </span>
              <span className="text-faint shrink-0">vs</span>
              <span className="font-bold text-orange-500 truncate text-right">
                ○ {playerO?.name ?? 'Player 2'}
                {playerO?.id === highlightPlayerId ? ' (you)' : ''}
              </span>
            </div>
            <ReadOnlyBoard board={session.board} />
          </>
        )}
      </div>
      <HostGameFinishedActions
        playAgainButton={playAgainButton}
        shareButton={
          <ShareResults
            captureRef={captureRef}
            game={game}
            participants={[]}
            votes={[]}
            rounds={[]}
            players={players}
            ticTacToeWinnerName={displayWinner ?? undefined}
            ticTacToeIsDraw={isDraw}
            ticTacToeEndedEarly={endedEarly}
          />
        }
      />
    </div>
  )
}
