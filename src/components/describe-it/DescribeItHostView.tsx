'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { HostGameHeader } from '@/components/host/HostGameHeader'
import { HostPageShell, hostPlayLayoutFlags } from '@/components/host/HostPageShell'
import { HostLobbyPlayersSection } from '@/components/host-lobby/HostLobbyPlayersSection'
import { HostLobbyWaitingFooter } from '@/components/host-lobby/HostLobbyWaitingFooter'
import { supabase } from '@/lib/supabase'
import {
  GAME_SELECT,
  PLAYER_SELECT,
  DESCRIBE_IT_SESSION_SELECT,
  DESCRIBE_IT_PLAYER_SELECT,
  DESCRIBE_IT_WORD_SELECT,
  DESCRIBE_IT_GUESS_SELECT,
} from '@/lib/supabase-selects'
import { useHostRemovePlayer } from '@/hooks/useHostRemovePlayer'
import type { DescribeItGuess, DescribeItPlayer, DescribeItSession, DescribeItWord, Game, Player } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { POLL_INTERVALS, supabasePollOk, usePolling } from '@/hooks/usePolling'
import { useApplyGameTheme } from '@/hooks/useApplyGameTheme'
import { GameRulesLink } from '@/components/ui/GameRulesLink'
import { useDescribeItTimer } from '@/hooks/useDescribeItTimer'
import {
  clampDescribeItTeams,
  describeItLobbyReady,
  DESCRIBE_IT_MIN_PLAYERS,
  isDescribeItResultsPhase,
} from '@/lib/describe-it'
import {
  DescribeItCard,
  DescribeItPrimaryButton,
  DescribeItTeamRoster,
} from '@/components/describe-it/DescribeItChrome'
import { DescribeItPlayPanel } from '@/components/describe-it/DescribeItPlay'
import { DescribeItFinalResultsShareBlock } from '@/components/describe-it/DescribeItFinalResultsShareBlock'

export function DescribeItHostView({ gameCode, hostToken }: { gameCode: string; hostToken: string }) {
  const { error: toastError, success } = useToast()
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [session, setSession] = useState<DescribeItSession | null>(null)
  const [teamRows, setTeamRows] = useState<DescribeItPlayer[]>([])
  const [words, setWords] = useState<DescribeItWord[]>([])
  const [guesses, setGuesses] = useState<DescribeItGuess[]>([])
  const [starting, setStarting] = useState(false)
  const [balancing, setBalancing] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [ending, setEnding] = useState(false)
  const [playingAgain, setPlayingAgain] = useState(false)
  const [loading, setLoading] = useState(true)

  useApplyGameTheme(game?.theme)

  const load = useCallback(async (): Promise<boolean> => {
    const [gameRes, plrsRes] = await Promise.all([
      supabase.from('games').select(GAME_SELECT).eq('id', gameCode).maybeSingle(),
      supabase.from('players').select(PLAYER_SELECT).eq('game_id', gameCode).order('joined_at'),
    ])
    if (!supabasePollOk(gameRes, plrsRes)) return false
    setGame(gameRes.data)
    setPlayers(plrsRes.data ?? [])
    setLoading(false)

    const [sessionRes, teamRes, wordRes, guessRes] = await Promise.all([
      supabase.from('describe_it_sessions').select(DESCRIBE_IT_SESSION_SELECT).eq('game_id', gameCode).maybeSingle(),
      supabase.from('describe_it_players').select(DESCRIBE_IT_PLAYER_SELECT).eq('game_id', gameCode).order('created_at'),
      supabase.from('describe_it_words').select(DESCRIBE_IT_WORD_SELECT).eq('game_id', gameCode),
      supabase
        .from('describe_it_guesses')
        .select(DESCRIBE_IT_GUESS_SELECT)
        .eq('game_id', gameCode)
        .order('created_at', { ascending: true })
        .limit(60),
    ])
    if (supabasePollOk(sessionRes)) setSession(sessionRes.data as DescribeItSession | null)
    if (supabasePollOk(teamRes)) setTeamRows((teamRes.data ?? []) as DescribeItPlayer[])
    if (supabasePollOk(wordRes)) setWords((wordRes.data ?? []) as DescribeItWord[])
    if (supabasePollOk(guessRes)) setGuesses((guessRes.data ?? []) as DescribeItGuess[])
    return true
  }, [gameCode])

  useEffect(() => {
    load()
  }, [load])

  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleLoad = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
    reloadTimerRef.current = setTimeout(() => void load(), 80)
  }, [load])

  useEffect(() => {
    const channel = supabase.channel(`describe-it-host-${gameCode}`)
    for (const table of [
      'games',
      'players',
      'describe_it_sessions',
      'describe_it_players',
      'describe_it_words',
      'describe_it_guesses',
    ]) {
      const filter = table === 'games' ? `id=eq.${gameCode}` : `game_id=eq.${gameCode}`
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, scheduleLoad)
    }
    channel.subscribe()
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
      supabase.removeChannel(channel)
    }
  }, [gameCode, scheduleLoad])

  usePolling(() => load(), [gameCode, load], { intervalMs: POLL_INTERVALS.realtimeFallback })

  const { removePlayer, removingPlayerId } = useHostRemovePlayer(gameCode, hostToken, () => void load())

  const post = async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/describe-it/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: gameCode, ...body }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Action failed')
  }

  const balanceTeams = async () => {
    setBalancing(true)
    try {
      await post('balance', { hostToken })
      await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to balance teams')
    } finally {
      setBalancing(false)
    }
  }

  const advanceTurn = async () => {
    setAdvancing(true)
    try {
      await post('advance', { hostToken })
      await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to advance')
    } finally {
      setAdvancing(false)
    }
  }

  const startGame = async () => {
    setStarting(true)
    try {
      const res = await fetch(`/api/games/${gameCode}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start')
      success('Game started!')
      await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to start')
    } finally {
      setStarting(false)
    }
  }

  const endGame = async () => {
    setEnding(true)
    try {
      const res = await fetch(`/api/games/${gameCode}/finish-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostToken }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to end')
      success('Game ended')
      await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to end')
    } finally {
      setEnding(false)
    }
  }

  const playAgain = async () => {
    setPlayingAgain(true)
    try {
      const res = await fetch(`/api/games/${gameCode}/play-again`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to reset')
      if (data.game) setGame(data.game)
      success('Ready for a new game!')
      await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to reset')
    } finally {
      setPlayingAgain(false)
    }
  }

  const { secondsLeft, breakLeft, urgent } = useDescribeItTimer(gameCode, session, game?.status === 'active')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }
  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-muted text-center">Game not found.</p>
      </div>
    )
  }

  const numTeams = clampDescribeItTeams(game.describe_it_num_teams)
  const teamPlain = teamRows.map((r) => ({ player_id: r.player_id, team: r.team }))
  const ready = describeItLobbyReady(teamPlain, numTeams)
  const readyPlayers = players.filter((p) => p.spectator !== true)
  const canStart = readyPlayers.length >= DESCRIBE_IT_MIN_PLAYERS && ready.ok
  const gameFinished = isDescribeItResultsPhase(game.status, session)
  const layout = hostPlayLayoutFlags('manage', false, game.status)

  return (
    <HostPageShell gameCode={gameCode} {...layout}>
      {!gameFinished && <HostGameHeader game={game} />}

      {gameFinished && (
        <DescribeItFinalResultsShareBlock
          game={game}
          players={players}
          words={words}
          numTeams={numTeams}
          playAgainButton={
            <DescribeItPrimaryButton onClick={playAgain} loading={playingAgain}>
              Play again
            </DescribeItPrimaryButton>
          }
        />
      )}

      {game.status === 'active' && !gameFinished && session && (
        <>
          <DescribeItPlayPanel
            session={session}
            players={players}
            teamRows={teamPlain}
            words={words}
            guesses={guesses}
            myPlayerId={null}
            secondsLeft={secondsLeft}
            breakLeft={breakLeft}
            urgent={urgent}
          />
          {session.phase === 'break' && (
            <button type="button" onClick={advanceTurn} disabled={advancing} className="btn-primary w-full py-2.5">
              {advancing ? 'Starting…' : 'Next team now →'}
            </button>
          )}
          <button type="button" onClick={endGame} disabled={ending} className="btn-secondary w-full py-3">
            {ending ? 'Ending…' : 'End game early'}
          </button>
        </>
      )}

      {game.status === 'waiting' && (
        <>
          <DescribeItCard className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">Teams ({numTeams})</p>
              <button
                type="button"
                onClick={balanceTeams}
                disabled={balancing}
                className="text-xs font-bold rounded-lg border border-[var(--border-strong)] px-3 py-1.5 hover:bg-[var(--primary)]/10"
              >
                {balancing ? 'Balancing…' : 'Auto-balance'}
              </button>
            </div>
            <DescribeItTeamRoster numTeams={numTeams} teamRows={teamPlain} players={players} />
            {!ready.ok && <p className="text-amber-400 text-xs text-center">{ready.error}</p>}
            <p className="text-center">
              <GameRulesLink gameType="describe_it" variant="subtle" />
            </p>
          </DescribeItCard>

          <HostLobbyPlayersSection
            players={players}
            removingPlayerId={removingPlayerId}
            onRemovePlayer={removePlayer}
          />

          <HostLobbyWaitingFooter
            gameCode={gameCode}
            hostToken={hostToken}
            onStart={startGame}
            onEnded={load}
            canStart={canStart}
            starting={starting}
            startDisabledHint={
              canStart
                ? null
                : readyPlayers.length < DESCRIBE_IT_MIN_PLAYERS
                  ? `Need at least ${DESCRIBE_IT_MIN_PLAYERS} players (${readyPlayers.length})`
                  : (ready.error ?? 'Every team needs at least 2 players')
            }
            className="space-y-3"
          />
        </>
      )}
    </HostPageShell>
  )
}
