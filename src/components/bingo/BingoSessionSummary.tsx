'use client'

import { BingoFinalResultsShareBlock } from '@/components/bingo/BingoFinalResultsShareBlock'
import type { BingoClaim, Game, Player } from '@/types'

function statusLabel(status: Game['status']): string {
  if (status === 'waiting') return 'Waiting to start'
  if (status === 'active') return 'In progress'
  return 'Finished'
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function BingoSessionSummary({
  game,
  players,
  claim,
  calledCount,
}: {
  game: Game
  players: Player[]
  claim: BingoClaim | null
  calledCount: number
}) {
  const winner = claim ? players.find((p) => p.id === claim.player_id) : null

  return (
    <div className="space-y-5">
      <div className="glass-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-faint text-[10px] uppercase tracking-wider">Status</p>
          <p className="font-medium mt-0.5">{statusLabel(game.status)}</p>
        </div>
        <div>
          <p className="text-faint text-[10px] uppercase tracking-wider">Created</p>
          <p className="mt-0.5">{formatDate(game.created_at)}</p>
        </div>
        <div>
          <p className="text-faint text-[10px] uppercase tracking-wider">Players</p>
          <p className="font-medium mt-0.5">{players.length}</p>
        </div>
        <div>
          <p className="text-faint text-[10px] uppercase tracking-wider">Numbers called</p>
          <p className="font-medium mt-0.5">{calledCount}</p>
        </div>
      </div>

      {winner ? (
        <BingoFinalResultsShareBlock game={game} players={players} winnerName={winner.name} />
      ) : game.status === 'finished' ? (
        <div className="glass-card p-8 text-center text-muted space-y-2">
          <p className="text-4xl">🏁</p>
          <p className="font-bold">Session ended</p>
          <p className="text-sm">No bingo winner was recorded.</p>
        </div>
      ) : game.status === 'waiting' ? (
        <div className="glass-card p-8 text-center text-muted">This bingo session never started.</div>
      ) : (
        <div className="glass-card p-8 text-center text-muted">Game in progress — no winner yet.</div>
      )}
    </div>
  )
}
