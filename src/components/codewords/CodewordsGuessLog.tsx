'use client'

import { roleLabel } from '@/lib/codewords'
import { CodewordsTeamBadge } from '@/components/codewords/CodewordsBoardGrid'
import type { CodewordsGuess, CodewordsPlayerRole, Player } from '@/types'

export function CodewordsGuessLog({
  guesses,
  players,
  roles,
  compact = false,
}: {
  guesses: CodewordsGuess[]
  players: Player[]
  roles: CodewordsPlayerRole[]
  compact?: boolean
}) {
  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? 'Unknown'
  const playerRole = (id: string) => roles.find((r) => r.player_id === id)

  if (guesses.length === 0) {
    return (
      <div className="glass-card p-4">
        <p className="label-caps">Guess log</p>
        <p className="text-faint text-xs mt-2">No guesses yet — who clicked what will show here.</p>
      </div>
    )
  }

  const sorted = [...guesses].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div className="glass-card p-4 space-y-3">
      <p className="label-caps">Guess log</p>
      <ul className={['space-y-2 overflow-y-auto pr-1', compact ? 'max-h-48' : 'max-h-72'].join(' ')}>
        {sorted.map((guess) => {
          const role = playerRole(guess.player_id)
          return (
            <li
              key={guess.id}
              className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface-inset-bg)] px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-1.5 font-medium">
                <span>{playerName(guess.player_id)}</span>
                {role && (
                  <>
                    <CodewordsTeamBadge team={role.team} />
                    <span className="text-faint">{roleLabel(role.role)}</span>
                  </>
                )}
              </div>
              <p className="mt-1">
                clicked <strong>{guess.word}</strong>
                <span className="text-faint"> · {guess.cell_type}</span>
              </p>
              {guess.clue_word && (
                <p className="text-faint mt-0.5">
                  Clue: {guess.clue_word} {guess.clue_number}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function CodewordsGuessSummary({ guesses, players }: { guesses: CodewordsGuess[]; players: Player[] }) {
  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? '?'
  const byCell = new Map<number, CodewordsGuess>()
  for (const guess of guesses) {
    if (!byCell.has(guess.cell_index)) byCell.set(guess.cell_index, guess)
  }

  if (byCell.size === 0) return null

  return (
    <div className="glass-card p-4 space-y-2">
      <p className="label-caps">Who clicked what</p>
      <ul className="space-y-1 text-xs">
        {Array.from(byCell.entries())
          .sort(([a], [b]) => a - b)
          .map(([index, guess]) => (
            <li key={index} className="flex justify-between gap-2 text-muted">
              <span className="font-medium text-[var(--foreground)]">{guess.word}</span>
              <span>{playerName(guess.player_id)}</span>
            </li>
          ))}
      </ul>
    </div>
  )
}
