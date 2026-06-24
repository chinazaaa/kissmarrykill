'use client'

import { useState } from 'react'
import { CodewordsTeamBadge } from '@/components/codewords/CodewordsBoardGrid'
import { GameLobbyPlayerList } from '@/components/ui/GameLobbyPlayerList'
import { GameRulesLink } from '@/components/ui/GameRulesLink'
import { roleLabel, teamLabel } from '@/lib/codewords'
import type { CodewordsPlayerRole, Player } from '@/types'

const RULES = [
  'Two teams — Red and Blue — each with one spymaster and operatives.',
  'Spymasters see the secret colour key and give a one-word clue plus a number (how many words it relates to).',
  'Operatives tap words on the 5×5 grid to guess. Correct guesses let you keep going; wrong guesses end your turn.',
  'First team to find all their words wins. Hit the assassin and your team loses!',
]

export function CodewordsWaitingPanel({
  playerName,
  myRole,
  players = [],
  myPlayerId,
  variant = 'lobby',
  manageHint,
  isSpectator = false,
  onReady,
}: {
  playerName: string
  myRole?: CodewordsPlayerRole | null
  players?: Pick<Player, 'id' | 'name' | 'spectator'>[]
  myPlayerId?: string | null
  variant?: 'lobby' | 'starting'
  manageHint?: string
  isSpectator?: boolean
  onReady?: () => Promise<void>
}) {
  const [readying, setReadying] = useState(false)
  const heading = variant === 'starting' ? 'Starting game…' : 'Waiting for the host to start'

  const handleReady = async () => {
    if (!onReady || readying) return
    setReadying(true)
    try {
      await onReady()
    } finally {
      setReadying(false)
    }
  }

  return (
    <div className="glass-card p-6 w-full max-w-lg space-y-5">
      <div className="text-center space-y-2">
        <p className="text-4xl" aria-hidden>
          {variant === 'starting' ? '🎲' : isSpectator ? '🎮' : '⏳'}
        </p>
        <h2 className="text-xl font-black">{heading}</h2>
        {isSpectator && variant !== 'starting' ? (
          <>
            <p className="text-muted text-sm">Tap below to join the next round</p>
            <button
              type="button"
              onClick={handleReady}
              disabled={readying}
              className="btn-primary w-full py-3 text-base font-bold"
            >
              {readying ? 'Joining…' : "I'm in — ready to play"}
            </button>
          </>
        ) : (
          <p className="text-muted text-sm">
            Playing as <strong className="text-[var(--text)]">{playerName}</strong>
          </p>
        )}
        {myRole && (
          <p className="text-sm flex items-center justify-center gap-2 flex-wrap">
            <CodewordsTeamBadge team={myRole.team} />
            <span className="text-muted">
              {teamLabel(myRole.team)} · {roleLabel(myRole.role)}
            </span>
          </p>
        )}
      </div>

      {variant !== 'starting' && (
        <>
          <p className="text-center">
            <GameRulesLink gameType="codewords" variant="subtle" />
          </p>
          <GameLobbyPlayerList players={players} myPlayerId={myPlayerId} label="In lobby" />
        </>
      )}

      <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-inset-bg)] p-4 space-y-3">
        <p className="label-caps">How to play</p>
        <ul className="space-y-2 text-sm text-muted leading-relaxed list-disc pl-4">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>

      {variant === 'lobby' && (
        <p className="text-center text-faint text-xs leading-relaxed">
          The game will begin automatically once the host starts. Keep this tab open.
        </p>
      )}

      {variant === 'starting' && <p className="text-center text-faint text-xs">Dealing the board…</p>}

      {manageHint && <p className="text-center text-faint text-xs leading-relaxed">{manageHint}</p>}
    </div>
  )
}
