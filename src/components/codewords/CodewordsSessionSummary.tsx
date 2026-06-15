'use client'

import { CodewordsBoardGrid } from '@/components/codewords/CodewordsBoardGrid'
import { CodewordsGuessLog } from '@/components/codewords/CodewordsGuessLog'
import { CodewordsScoreboard } from '@/components/codewords/CodewordsScoreboard'
import { guessAttributionMap, teamLabel } from '@/lib/codewords'
import type { CodewordsBoard, CodewordsGuess, CodewordsPlayerRole, Game, Player } from '@/types'

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

export function CodewordsSessionSummary({
  game,
  players,
  roles,
  board,
  guesses,
}: {
  game: Game
  players: Player[]
  roles: CodewordsPlayerRole[]
  board: CodewordsBoard | null
  guesses: CodewordsGuess[]
}) {
  const playerNameById = new Map(players.map((p) => [p.id, p.name]))
  const cellAttribution = board ? guessAttributionMap(guesses, playerNameById) : {}
  const neverStarted = game.status === 'waiting' || !board

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
          <p className="text-faint text-[10px] uppercase tracking-wider">Guesses</p>
          <p className="font-medium mt-0.5">{guesses.length}</p>
        </div>
      </div>

      {neverStarted ? (
        <div className="glass-card p-8 text-center text-muted">
          This codewords session never started — no board was dealt.
        </div>
      ) : (
        <>
          {board?.winner ? (
            <div className="glass-card p-6 text-center space-y-2 border-amber-400/40">
              <p className="text-4xl">🏆</p>
              <p className="text-xl font-black text-amber-600 dark:text-amber-200">
                {teamLabel(board.winner)} team wins!
              </p>
            </div>
          ) : game.status === 'finished' ? (
            <div className="glass-card p-6 text-center space-y-2">
              <p className="text-4xl">🏁</p>
              <p className="text-lg font-bold">Session ended</p>
              <p className="text-muted text-sm">The host closed the game before a team won.</p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4 items-start">
            <div className="glass-card p-4 space-y-3">
              <p className="label-caps">Final board</p>
              <CodewordsBoardGrid board={board!} showKey cellAttribution={cellAttribution} />
            </div>
            <aside className="space-y-3">
              <CodewordsScoreboard board={board!} players={players} roles={roles} />
              <CodewordsGuessLog guesses={guesses} players={players} roles={roles} />
            </aside>
          </div>
        </>
      )}

      {roles.length > 0 && (
        <div className="glass-card p-4 space-y-3">
          <p className="label-caps">Teams</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {(['red', 'blue'] as const).map((team) => {
              const members = roles.filter((r) => r.team === team)
              return (
                <div key={team}>
                  <p className="font-bold capitalize mb-2">{team} team</p>
                  {members.length === 0 ? (
                    <p className="text-faint text-xs">No players</p>
                  ) : (
                    <ul className="space-y-1">
                      {members.map((r) => (
                        <li key={r.player_id} className="text-muted">
                          {playerNameById.get(r.player_id) ?? 'Unknown'} · {r.role}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
