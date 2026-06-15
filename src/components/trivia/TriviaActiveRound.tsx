'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PaginatedLeaderboard } from '@/components/PaginatedLeaderboard'
import {
  formatTriviaChoiceLabel,
  parseTriviaMetadata,
  revealCountdownSeconds,
  tallyTriviaPlayerScores,
  TRIVIA_REVEAL_SECONDS,
} from '@/lib/trivia'
import { useRoundTimer } from '@/hooks/useRoundTimer'
import { useTriviaNotifications } from '@/hooks/useTriviaNotifications'
import { playVoteSubmittedSound } from '@/lib/sounds'
import { useToast } from '@/components/ui/Toast'
import type { Game, Player, Round, TriviaAnswer } from '@/types'

type PlayScreen = 'waiting' | 'active' | 'locked' | 'revealed' | 'finished'

const CHOICE_BADGE =
  'inline-flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white font-black'
const TIMER_BADGE =
  'inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] px-3.5 py-1.5 font-bold text-white tabular-nums text-base'
const COUNTDOWN_TEXT = 'text-[var(--primary-strong)] dark:text-rose-300 font-bold text-lg sm:text-xl'

interface TriviaActiveRoundProps {
  gameCode: string
  game: Game
  players: Player[]
  rounds: Round[]
  answers: TriviaAnswer[]
  myPlayerId: string
  playerName: string
}

export function TriviaActiveRound({
  gameCode,
  game,
  players,
  rounds,
  answers,
  myPlayerId,
  playerName,
}: TriviaActiveRoundProps) {
  const { error: toastError } = useToast()
  const [pendingChoice, setPendingChoice] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; points: number } | null>(null)
  const [timeExpired, setTimeExpired] = useState(false)
  const [revealCountdown, setRevealCountdown] = useState(TRIVIA_REVEAL_SECONDS)

  const currentRound = useMemo(
    () => rounds.find((r) => r.round_number === game.current_round_number) ?? null,
    [rounds, game.current_round_number]
  )
  const metadata = currentRound ? parseTriviaMetadata(currentRound.trivia_metadata) : null
  const myAnswer = useMemo(
    () =>
      currentRound ? answers.find((a) => a.player_id === myPlayerId && a.round_id === currentRound.id) ?? null : null,
    [answers, currentRound, myPlayerId]
  )
  const roundAnswerCount = useMemo(
    () => (currentRound ? answers.filter((a) => a.round_id === currentRound.id).length : 0),
    [answers, currentRound]
  )
  const leaderboard = useMemo(() => tallyTriviaPlayerScores(answers, players), [answers, players])
  const isLastRound = (game.current_round_number ?? 0) >= (game.rounds_count ?? 0)

  const screen: PlayScreen = useMemo(() => {
    if (game.status === 'finished') return 'finished'
    if (!currentRound || currentRound.status === 'pending') return 'waiting'
    if (currentRound.status === 'finished') return 'revealed'
    if (myAnswer || lastResult || timeExpired) return 'locked'
    return 'active'
  }, [game.status, currentRound, myAnswer, lastResult, timeExpired])

  useEffect(() => {
    setPendingChoice(null)
    setLastResult(null)
    setTimeExpired(false)
  }, [currentRound?.id])

  useEffect(() => {
    if (screen !== 'revealed' || !currentRound?.ended_at) return
    const tick = () => setRevealCountdown(revealCountdownSeconds(currentRound.ended_at))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [screen, currentRound?.ended_at, currentRound?.id])

  const timeLeft = useRoundTimer({
    game,
    currentRound: currentRound?.status === 'active' ? currentRound : null,
    active: screen === 'active',
    onExpire: () => setTimeExpired(true),
  })

  const correct = myAnswer?.is_correct ?? lastResult?.isCorrect

  useTriviaNotifications({
    game,
    currentRound,
    screen,
    correct,
    timeLeft,
    timeExpired,
  })

  const submitAnswer = useCallback(
    async (choiceIndex: number) => {
      if (!currentRound || submitting || myAnswer) return
      setSubmitting(true)
      try {
        const res = await fetch('/api/trivia/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: gameCode,
            playerId: myPlayerId,
            roundId: currentRound.id,
            choiceIndex,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to submit')
        setLastResult({ isCorrect: data.isCorrect, points: data.points })
        setPendingChoice(null)
        playVoteSubmittedSound()
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Failed to submit')
      } finally {
        setSubmitting(false)
      }
    },
    [currentRound, submitting, myAnswer, gameCode, myPlayerId, toastError]
  )

  const points = myAnswer?.points ?? lastResult?.points ?? 0
  const waitingForOthers = Math.max(0, players.length - roundAnswerCount)
  const allAnswered = players.length > 0 && roundAnswerCount >= players.length

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <p className="text-muted text-sm sm:text-base">
          Playing as <span className="text-body font-semibold">{playerName}</span>
        </p>
        {currentRound && game.status === 'active' && (
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm sm:text-base text-muted">
            <span>
              Round {currentRound.round_number} of {game.rounds_count}
            </span>
            {screen === 'active' && <span className={TIMER_BADGE}>{timeLeft}s</span>}
          </div>
        )}
      </div>

      {screen === 'waiting' && (
        <div className="glass-card-strong p-8 sm:p-10 text-center space-y-3">
          <p className="text-xl sm:text-2xl font-bold text-body">Get ready…</p>
          <p className="text-muted text-base">Waiting for the next question</p>
        </div>
      )}

      {screen === 'active' && metadata && pendingChoice == null && (
        <div className="glass-card-strong p-6 sm:p-8 space-y-6">
          <p className="text-xl sm:text-2xl font-bold text-body leading-snug text-center sm:text-left">
            {metadata.question}
          </p>
          <div className="grid gap-3 sm:gap-4">
            {metadata.choices.map((choice, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPendingChoice(i)}
                className="rounded-2xl border-2 border-[var(--border-strong)] px-5 py-4 sm:py-5 text-left text-base sm:text-lg font-medium hover:border-[var(--primary)] hover:bg-rose-500/5 transition-colors flex items-center gap-3"
              >
                <span className={CHOICE_BADGE}>{formatTriviaChoiceLabel(i)}</span>
                <span className="flex-1">{choice}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {screen === 'active' && metadata && pendingChoice != null && (
        <div className="glass-card-strong p-6 sm:p-8 space-y-6">
          <p className="label-caps text-center">Confirm your answer</p>
          <p className="text-lg sm:text-xl text-muted text-center leading-snug">{metadata.question}</p>
          <div className="rounded-2xl border-2 border-[var(--primary)] bg-rose-500/8 px-5 py-4 sm:py-5 text-base sm:text-lg font-semibold flex items-center justify-center gap-3 text-center">
            <span className={CHOICE_BADGE}>{formatTriviaChoiceLabel(pendingChoice)}</span>
            <span>{metadata.choices[pendingChoice]}</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPendingChoice(null)}
              disabled={submitting}
              className="btn-secondary w-full py-3.5 text-base"
            >
              Change answer
            </button>
            <button
              type="button"
              onClick={() => submitAnswer(pendingChoice)}
              disabled={submitting}
              className="btn-primary w-full py-3.5 text-base"
            >
              {submitting ? 'Submitting…' : 'Confirm & lock in'}
            </button>
          </div>
        </div>
      )}

      {(screen === 'locked' || screen === 'revealed') && metadata && currentRound && (
        <div className="glass-card-strong p-6 sm:p-8 space-y-4 text-center">
          {myAnswer || lastResult ? (
            <>
              <p className={`text-2xl sm:text-3xl font-black ${correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted'}`}>
                {correct ? 'Correct!' : 'Not quite…'}
              </p>
              <p className="text-lg text-muted">+{points} points</p>
            </>
          ) : (
            <p className="text-xl font-bold text-body">Time&apos;s up — no answer submitted</p>
          )}
          {(screen === 'revealed' || currentRound.status === 'finished') && (
            <p className="text-base sm:text-lg text-body pt-2">
              Answer:{' '}
              <span className="font-semibold">
                {formatTriviaChoiceLabel(metadata.correct_index)}. {metadata.choices[metadata.correct_index]}
              </span>
            </p>
          )}
          {screen === 'locked' && currentRound.status === 'active' && (
            <p className="text-muted text-sm sm:text-base">
              {allAnswered
                ? 'Everyone answered — revealing results…'
                : waitingForOthers === 1
                  ? 'Waiting for 1 more player…'
                  : `Waiting for ${waitingForOthers} more players…`}
              <span className="block text-faint text-xs mt-1">
                {roundAnswerCount}/{players.length} answered
              </span>
            </p>
          )}
          {screen === 'revealed' && game.status === 'active' && (
            <p className={`${COUNTDOWN_TEXT} pt-2`}>
              {isLastRound
                ? `Final results in ${revealCountdown}s…`
                : `Next question in ${revealCountdown}s…`}
            </p>
          )}
        </div>
      )}

      <PaginatedLeaderboard
        title="Leaderboard"
        rows={leaderboard.map((row, i) => ({ ...row, rank: i + 1 }))}
        highlightId={myPlayerId}
        scoreLabel={(n) => `${n} pts`}
      />

      {screen === 'finished' && (
        <div className="glass-card-strong p-8 text-center space-y-2">
          <p className="text-4xl">🏆</p>
          <p className="text-2xl font-black">Game over!</p>
          {leaderboard[0] && (
            <p className="text-muted text-base mt-2">
              {leaderboard[0].name} wins with {leaderboard[0].score} pts
            </p>
          )}
        </div>
      )}
    </div>
  )
}
