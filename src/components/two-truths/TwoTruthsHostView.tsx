'use client'

import { useCallback, useEffect, useState } from 'react'
import { TwoTruthsActiveRound } from '@/components/two-truths/TwoTruthsActiveRound'
import { TwoTruthsHostManagePanel } from '@/components/two-truths/TwoTruthsHostManagePanel'
import { TwoTruthsLobbySubmit } from '@/components/two-truths/TwoTruthsLobbySubmit'
import { gameTypeConfig } from '@/lib/game-types'
import { useTwoTruthsAdvance } from '@/hooks/useTwoTruthsAdvance'
import { supabase } from '@/lib/supabase'
import { appOrigin } from '@/lib/site'
import { getPlayerSession, setPlayerSession } from '@/lib/utils'
import type { Game, Player, Round, TtlGuess, TtlStatement } from '@/types'
import { useToast } from '@/components/ui/Toast'

export function TwoTruthsHostView({ gameCode, hostToken }: { gameCode: string; hostToken: string }) {
  const { error: toastError, success } = useToast()
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [statements, setStatements] = useState<TtlStatement[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [guesses, setGuesses] = useState<TtlGuess[]>([])
  const [starting, setStarting] = useState(false)
  const [playingAgain, setPlayingAgain] = useState(false)
  const [savingTimer, setSavingTimer] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(45)
  const [hostPlayerId, setHostPlayerId] = useState<string | null>(null)
  const [hostPlayerName, setHostPlayerName] = useState('')
  const [hostJoinName, setHostJoinName] = useState('')
  const [hostJoining, setHostJoining] = useState(false)

  const load = useCallback(async () => {
    const [{ data: gameData }, { data: plrs }, { data: stmts }, { data: rds }, { data: gss }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameCode).maybeSingle(),
      supabase.from('players').select('*').eq('game_id', gameCode).order('joined_at'),
      supabase.from('ttl_statements').select('*').eq('game_id', gameCode),
      supabase.from('rounds').select('*').eq('game_id', gameCode).order('round_number'),
      supabase.from('ttl_guesses').select('*').eq('game_id', gameCode),
    ])
    if (gameData) {
      setGame(gameData)
      setTimerSeconds(gameData.timer_seconds ?? 45)
    }
    setPlayers(plrs ?? [])
    setStatements(stmts ?? [])
    setRounds(rds ?? [])
    setGuesses(gss ?? [])
  }, [gameCode])

  useEffect(() => {
    load()
    const session = getPlayerSession(gameCode)
    if (session) {
      setHostPlayerId(session.playerId)
      setHostPlayerName(session.playerName)
    }
  }, [gameCode, load])

  useEffect(() => {
    const channel = supabase
      .channel(`ttl-host-${gameCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameCode}` }, (p) => {
        setGame(p.new as Game)
        void load()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `game_id=eq.${gameCode}` }, () =>
        load()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttl_statements', filter: `game_id=eq.${gameCode}` }, () =>
        load()
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rounds', filter: `game_id=eq.${gameCode}` }, () =>
        load()
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ttl_guesses', filter: `game_id=eq.${gameCode}` }, () =>
        load()
      )
      .subscribe()

    const poll = setInterval(load, 800)
    return () => {
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [gameCode, load])

  useTwoTruthsAdvance({
    gameCode,
    game: game ?? ({ status: 'waiting', id: gameCode } as Game),
    enabled: !!game && game.status === 'active',
    onAdvanced: load,
  })

  const hostJoinGame = async () => {
    const name = hostJoinName.trim()
    if (!name) return
    setHostJoining(true)
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameCode, playerName: name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to join')
      setPlayerSession(gameCode, data.playerId, data.playerName, data.playerGender)
      setHostPlayerId(data.playerId)
      setHostPlayerName(data.playerName)
      await load()
      success(`Joined as ${data.playerName}`)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to join')
    } finally {
      setHostJoining(false)
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
      await load()
      success('Game started!')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to start')
    } finally {
      setStarting(false)
    }
  }

  const saveTimer = async () => {
    setSavingTimer(true)
    try {
      const res = await fetch(`/api/games/${gameCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostToken, timer_seconds: timerSeconds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save timer')
      if (data.game) setGame(data.game)
      success('Timer updated')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save timer')
    } finally {
      setSavingTimer(false)
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
      setRounds([])
      setGuesses([])
      setStatements([])
      await load()
      success('Lobby reopened!')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to reset')
    } finally {
      setPlayingAgain(false)
    }
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  const cfg = gameTypeConfig('two_truths')
  const playerLink = `${appOrigin()}/game/${gameCode}`
  const myStatement = hostPlayerId ? statements.find((s) => s.player_id === hostPlayerId) : null

  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="text-4xl">{cfg.headerEmoji}</div>
          <h1 className="text-2xl font-black gradient-title">{game.title}</h1>
          <p className="text-muted text-sm">{cfg.tagline}</p>
        </div>

        {game.status === 'waiting' && !hostPlayerId && (
          <div className="glass-card p-4 space-y-3">
            <p className="label-caps">Join as player (optional)</p>
            <div className="flex items-center gap-2">
              <div className="w-36 sm:w-44 shrink-0">
                <input
                  type="text"
                  value={hostJoinName}
                  onChange={(e) => setHostJoinName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && hostJoinGame()}
                  placeholder="Your name"
                  className="input-field w-full"
                  maxLength={40}
                />
              </div>
              <button
                type="button"
                onClick={hostJoinGame}
                disabled={!hostJoinName.trim() || hostJoining}
                className="btn-primary btn-fit shrink-0 px-4 py-2.5 text-sm whitespace-nowrap"
              >
                {hostJoining ? 'Joining…' : 'Join'}
              </button>
            </div>
          </div>
        )}

        {game.status === 'waiting' && hostPlayerId && !myStatement && (
          <div className="glass-card p-5">
            <p className="label-caps mb-3">Your statements</p>
            <TwoTruthsLobbySubmit gameCode={gameCode} playerId={hostPlayerId} onSaved={load} />
          </div>
        )}

        {game.status === 'waiting' && hostPlayerId && myStatement && (
          <div className="glass-card p-4 text-center text-sm text-emerald-700 dark:text-emerald-200">
            ✓ You&apos;re ready — waiting for other players
          </div>
        )}

        {game.status === 'active' && hostPlayerId && (
          <TwoTruthsActiveRound
            gameCode={gameCode}
            game={game}
            players={players}
            rounds={rounds}
            guesses={guesses}
            myPlayerId={hostPlayerId}
            playerName={hostPlayerName}
            onReload={load}
            skipGameSync
          />
        )}

        <TwoTruthsHostManagePanel
          game={game}
          playerLink={playerLink}
          players={players}
          statements={statements}
          rounds={rounds}
          guesses={guesses}
          starting={starting}
          playingAgain={playingAgain}
          onStartGame={startGame}
          onPlayAgain={playAgain}
          onTimerChange={setTimerSeconds}
          savingTimer={savingTimer}
          onSaveTimer={saveTimer}
        />
      </div>
    </div>
  )
}
