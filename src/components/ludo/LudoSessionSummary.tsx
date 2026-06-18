'use client'

import { CreateNewGameButton } from '@/components/ui/CreateNewGameButton'
import { gameTypeConfig } from '@/lib/game-types'
import { finishedPieceCount, LUDO_COLOR_LABELS } from '@/lib/ludo'
import type { Game, LudoPlayerState, LudoSession, Player } from '@/types'

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

export function LudoSessionSummary({
  game,
  players,
  states,
  session,
}: {
  game: Game
  players: Player[]
  states: LudoPlayerState[]
  session: LudoSession | null
}) {
  const cfg = gameTypeConfig('ludo')
  const winner = players.find((p) => p.id === session?.winner_player_id)
  const neverStarted = game.status === 'waiting' || !session

  const standings = states
    .map((state) => {
      const player = players.find((p) => p.id === state.player_id)
      return {
        playerId: state.player_id,
        name: player?.name ?? 'Unknown',
        color: state.color,
        finishedCount: finishedPieceCount(state.pieces),
      }
    })
    .sort((a, b) => {
      if (session?.winner_player_id) {
        if (a.playerId === session.winner_player_id) return -1
        if (b.playerId === session.winner_player_id) return 1
      }
      return b.finishedCount - a.finishedCount || a.name.localeCompare(b.name)
    })

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
          <p className="text-faint text-[10px] uppercase tracking-wider">Pieces home</p>
          <p className="font-medium mt-0.5">
            {standings.length > 0 ? `${standings[0]?.finishedCount ?? 0}/4 best` : '—'}
          </p>
        </div>
      </div>

      {neverStarted ? (
        <div className="glass-card p-8 text-center text-muted">This Ludo session never started.</div>
      ) : (
        <div className="glass-card-strong p-6 sm:p-8 space-y-4">
          <div className="text-center space-y-2">
            <p className="text-3xl sm:text-4xl leading-none">{cfg.headerEmoji}</p>
            <p className="text-2xl sm:text-3xl font-black gradient-title">{game.title}</p>
            <p className="text-muted text-xs uppercase tracking-wider">Final results</p>
          </div>
          {winner ? (
            <>
              <p className="text-5xl sm:text-6xl leading-none text-center pt-1">🏆</p>
              <p className="text-xl sm:text-2xl font-black text-center text-[var(--marry)]">{winner.name} wins!</p>
            </>
          ) : game.status === 'finished' ? (
            <div className="text-center space-y-2">
              <p className="text-4xl">🏁</p>
              <p className="text-lg font-bold">Session ended</p>
            </div>
          ) : (
            <p className="text-center text-muted text-sm">Game in progress</p>
          )}
          {session?.status_message && (
            <p className="text-center text-xs text-muted max-w-sm mx-auto">{session.status_message}</p>
          )}
          {standings.length > 0 && (
            <div className="space-y-2 pt-2">
              {standings.map((row, index) => {
                const isWinner = row.playerId === session?.winner_player_id
                return (
                  <div
                    key={row.playerId}
                    className={[
                      'flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5',
                      isWinner
                        ? 'border-[color-mix(in_srgb,var(--marry)_45%,var(--border-strong))] bg-[color-mix(in_srgb,var(--marry)_10%,var(--surface-inset-bg))]'
                        : 'border-[var(--border-strong)] bg-[var(--surface-inset-bg)]',
                    ].join(' ')}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">
                        {isWinner ? '🏆 ' : `${index + 1}. `}
                        {row.name}
                      </p>
                      <p className="text-[11px] text-muted">{LUDO_COLOR_LABELS[row.color]} · {row.finishedCount}/4 home</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {!neverStarted && <CreateNewGameButton />}
    </div>
  )
}
