'use client'

import { useState } from 'react'
import {
  computeDescribeItScores,
  teamLabel,
  teamForTurn,
  type DescribeItTeamScore,
} from '@/lib/describe-it'
import type { DescribeItGuess, DescribeItSession, DescribeItWord, Player } from '@/types'
import { DescribeItCard, DescribeItScoreboard, teamStyle } from '@/components/describe-it/DescribeItChrome'

function GuessFeed({
  guesses,
  players,
  turnIndex,
}: {
  guesses: DescribeItGuess[]
  players: Player[]
  turnIndex: number
}) {
  const nameById = new Map(players.map((p) => [p.id, p.name]))
  const recent = guesses
    .filter((g) => g.turn_index === turnIndex)
    .slice(-7)
    .reverse()
  if (recent.length === 0) {
    return <p className="text-faint text-xs text-center py-2">Guesses appear here…</p>
  }
  return (
    <div className="space-y-1 max-h-40 overflow-y-auto">
      {recent.map((g) => (
        <div key={g.id} className="flex items-center gap-1.5 text-sm">
          <span className="text-faint shrink-0 truncate max-w-[40%]">{nameById.get(g.player_id) ?? 'Player'}:</span>
          <span className={g.correct ? 'font-black text-emerald-400' : 'text-[var(--foreground)]'}>{g.text}</span>
          {g.correct && <span>✅</span>}
        </div>
      ))}
    </div>
  )
}

function ClueOrGuessInput({
  placeholder,
  buttonLabel,
  onSubmit,
  disabled,
}: {
  placeholder: string
  buttonLabel: string
  onSubmit: (text: string) => void
  disabled?: boolean
}) {
  const [value, setValue] = useState('')
  const submit = () => {
    const text = value.trim()
    if (!text || disabled) return
    onSubmit(text)
    setValue('')
  }
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={80}
        className="input-field flex-1"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
        className="btn-primary btn-fit shrink-0 px-4 py-2.5 text-sm whitespace-nowrap"
      >
        {buttonLabel}
      </button>
    </div>
  )
}

export function DescribeItPlayPanel({
  session,
  players,
  teamRows,
  words,
  guesses,
  myPlayerId,
  secondsLeft,
  breakLeft,
  urgent,
  onClue,
  onGuess,
  onSkip,
  acting,
}: {
  session: DescribeItSession
  players: Player[]
  teamRows: { player_id: string; team: number }[]
  words: DescribeItWord[]
  guesses: DescribeItGuess[]
  myPlayerId: string | null
  secondsLeft: number
  breakLeft: number
  urgent: boolean
  onClue?: (clue: string) => void
  onGuess?: (text: string) => void
  onSkip?: () => void
  acting?: boolean
}) {
  const scores: DescribeItTeamScore[] = computeDescribeItScores(words, session.num_teams)
  const activeTeam = session.active_team
  const activeStyle = teamStyle(activeTeam)
  const myTeam = teamRows.find((r) => r.player_id === myPlayerId)?.team ?? null
  const isDescriber = !!myPlayerId && session.describer_player_id === myPlayerId
  const onActiveTeam = myTeam === activeTeam
  const describerName = players.find((p) => p.id === session.describer_player_id)?.name ?? 'Someone'

  return (
    <div className="space-y-4">
      <DescribeItScoreboard
        scores={scores}
        activeTeam={activeTeam}
        round={session.current_round}
        totalRounds={session.total_rounds}
      />

      {session.phase === 'break' && (
        <DescribeItCard className="p-5 text-center space-y-2">
          <p className="text-3xl">⏭️</p>
          <p className="text-base font-bold">{session.status_message}</p>
          <p className="text-faint text-sm">
            Next up: <span className="font-bold">{teamLabel(teamForTurn(session.turn_index + 1, session.num_teams))}</span>{' '}
            in {breakLeft}s
          </p>
        </DescribeItCard>
      )}

      {session.phase === 'turn' && (
        <>
          <DescribeItCard className={`p-3 flex items-center justify-between ${urgent ? 'animate-pulse' : ''}`}>
            <span className={`text-sm font-black ${activeStyle.text}`}>{teamLabel(activeTeam)}&apos;s turn</span>
            <span className={`text-2xl font-black tabular-nums ${urgent ? 'text-amber-400' : ''}`}>
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
            </span>
          </DescribeItCard>

          {isDescriber ? (
            <DescribeItCard className="p-4 space-y-3 text-center">
              <p className="label-caps text-[var(--primary)]">Describe this — don&apos;t say it!</p>
              <p className="text-3xl sm:text-4xl font-black tracking-tight break-words">{session.current_word}</p>
              {onClue && (
                <ClueOrGuessInput placeholder="Type a clue…" buttonLabel="Send" onSubmit={onClue} disabled={!!acting} />
              )}
              {onSkip && (
                <button
                  type="button"
                  onClick={onSkip}
                  disabled={!!acting}
                  className="text-sm font-semibold text-muted hover:text-[var(--foreground)] underline"
                >
                  Skip this word
                </button>
              )}
            </DescribeItCard>
          ) : (
            <DescribeItCard className="p-4 space-y-3">
              <p className="text-center text-sm text-faint">
                🗣️ <span className="font-bold">{describerName}</span> is describing for {teamLabel(activeTeam)}
              </p>
              <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-inset-bg)] px-4 py-4 text-center min-h-[3.5rem] flex items-center justify-center">
                {session.current_clue ? (
                  <p className="text-xl font-bold">“{session.current_clue}”</p>
                ) : (
                  <p className="text-faint text-sm animate-pulse">Waiting for a clue…</p>
                )}
              </div>
              {onActiveTeam && onGuess ? (
                <ClueOrGuessInput
                  placeholder="Type your guess…"
                  buttonLabel="Guess"
                  onSubmit={onGuess}
                  disabled={!!acting}
                />
              ) : (
                <p className="text-center text-faint text-xs">
                  {myTeam ? 'Waiting for your team’s turn' : 'Watching'}
                </p>
              )}
            </DescribeItCard>
          )}

          <DescribeItCard className="p-3">
            <GuessFeed guesses={guesses} players={players} turnIndex={session.turn_index} />
          </DescribeItCard>
        </>
      )}
    </div>
  )
}
