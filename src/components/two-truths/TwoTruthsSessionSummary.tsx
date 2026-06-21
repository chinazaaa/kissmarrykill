'use client'

import { PaginatedLeaderboard } from '@/components/PaginatedLeaderboard'
import { TwoTruthsSubmitterBadge } from '@/components/two-truths/TwoTruthsSubmitterBadge'
import { TwoTruthsShareBlock } from '@/components/two-truths/TwoTruthsShareBlock'
import { formatTtlChoiceLabel, parseTtlMetadata, tallyTtlScores } from '@/lib/two-truths'
import type { Game, Player, Round, TtlGuess, TtlStatement } from '@/types'

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

export function TwoTruthsSessionSummary({
  game,
  players,
  rounds,
  guesses,
  statements,
}: {
  game: Game
  players: Player[]
  rounds: Round[]
  guesses: TtlGuess[]
  statements: TtlStatement[]
}) {
  const leaderboard = tallyTtlScores(guesses, players, rounds)
  const finishedRounds = rounds.filter((r) => r.status === 'finished')

  return (
    <div className="space-y-6">
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
          <p className="text-faint text-[10px] uppercase tracking-wider">Rounds played</p>
          <p className="font-medium mt-0.5">{finishedRounds.length}</p>
        </div>
      </div>

      {game.status === 'waiting' && statements.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted">This session never started — no statements submitted.</div>
      ) : leaderboard.length > 0 ? (
        <TwoTruthsShareBlock game={game}>
          <PaginatedLeaderboard
            title="Final leaderboard"
            rows={leaderboard.map((row, i) => ({ id: row.id, name: row.name, score: row.score, rank: i + 1 }))}
            scoreLabel={(score) => `${score} pts`}
          />
        </TwoTruthsShareBlock>
      ) : (
        <div className="glass-card p-8 text-center text-muted">No scores recorded yet.</div>
      )}

      {finishedRounds.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-muted text-xs uppercase tracking-wider">Rounds</h2>
          {finishedRounds.map((round) => {
            const metadata = parseTtlMetadata(round.ttl_metadata)
            if (!metadata) return null
            return (
              <section key={round.id} className="glass-card p-5 space-y-3">
                <p className="label-caps">Round {round.round_number}</p>
                <div className="flex justify-center">
                  <TwoTruthsSubmitterBadge submitterId={round.submitter_player_id} players={players} />
                </div>
                <div className="space-y-2">
                  {metadata.statements.map((statement, index) => {
                    const isLie = index === metadata.lie_index
                    return (
                      <div
                        key={index}
                        className={[
                          'rounded-xl border px-3 py-2 text-sm',
                          isLie ? 'border-violet-500/60 bg-violet-500/10' : 'border-[var(--border-strong)]',
                        ].join(' ')}
                      >
                        <span className="font-bold mr-2">{formatTtlChoiceLabel(index)}.</span>
                        {statement}
                        {isLie && (
                          <span className="block text-violet-600 dark:text-violet-300 text-xs font-bold mt-1">
                            🤥 The lie
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
