'use client'

import { useCallback, useEffect, useState } from 'react'
import { GameTypeBadge } from '@/components/GameTypeBadge'
import { TwoTruthsActiveRound } from '@/components/two-truths/TwoTruthsActiveRound'
import { TwoTruthsLobbySubmit } from '@/components/two-truths/TwoTruthsLobbySubmit'
import { gameTypeConfig } from '@/lib/game-types'
import { supabase } from '@/lib/supabase'
import { getPlayerSession, setPlayerSession, clearPlayerSession } from '@/lib/utils'
import type { Game, Player, Round, TtlGuess, TtlStatement } from '@/types'
import { useToast } from '@/components/ui/Toast'

type Screen = 'loading' | 'join' | 'lobby' | 'playing' | 'not_found'

export function TwoTruthsPlayerView({ gameCode }: { gameCode: string }) {
  const { error: toastError, success } = useToast()
  const [screen, setScreen] = useState<Screen>('loading')
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [statements, setStatements] = useState<TtlStatement[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [guesses, setGuesses] = useState<TtlGuess[]>([])
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [myPlayerName, setMyPlayerName] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joining, setJoining] = useState(false)

  const load = useCallback(async () => {
    const [{ data: gameData }, { data: plrs }, { data: stmts }, { data: rds }, { data: gss }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameCode).maybeSingle(),
      supabase.from('players').select('*').eq('game_id', gameCode).order('joined_at'),
      supabase.from('ttl_statements').select('*').eq('game_id', gameCode),
      supabase.from('rounds').select('*').eq('game_id', gameCode).order('round_number'),
      supabase.from('ttl_guesses').select('*').eq('game_id', gameCode),
    ])

    if (!gameData) {
      setScreen('not_found')
      return
    }

    setGame(gameData)
    setPlayers(plrs ?? [])
    setStatements(stmts ?? [])
    setRounds(rds ?? [])
    setGuesses(gss ?? [])

    const session = getPlayerSession(gameCode)
    let playerId = session?.playerId ?? null
    if (session && plrs && !plrs.some((p) => p.id === session.playerId)) {
      clearPlayerSession(gameCode)
      playerId = null
      setMyPlayerId(null)
      setMyPlayerName('')
    } else if (session) {
      setMyPlayerId(session.playerId)
      setMyPlayerName(session.playerName)
    }

    if (!playerId) {
      setScreen('join')
      return
    }

    const hasStatement = (stmts ?? []).some((s) => s.player_id === playerId)
    if (gameData.status === 'waiting') {
      setScreen(hasStatement ? 'lobby' : 'lobby')
    } else {
      setScreen('playing')
    }
  }, [gameCode])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel(`ttl-player-${gameCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameCode}` }, () =>
        load()
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rounds', filter: `game_id=eq.${gameCode}` }, () =>
        load()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttl_statements', filter: `game_id=eq.${gameCode}` }, () =>
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

  const joinGame = async () => {
    const name = joinName.trim()
    if (!name) return
    setJoining(true)
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameCode, playerName: name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to join')
      setPlayerSession(gameCode, data.playerId, data.playerName, data.playerGender)
      setMyPlayerId(data.playerId)
      setMyPlayerName(data.playerName)
      await load()
      success(`Joined as ${data.playerName}`)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to join')
    } finally {
      setJoining(false)
    }
  }

  const cfg = gameTypeConfig('two_truths')
  const myStatement = myPlayerId ? statements.find((s) => s.player_id === myPlayerId) : null
  const existingStatements = myStatement
    ? ([myStatement.statement_a, myStatement.statement_b, myStatement.statement_c] as [string, string, string])
    : null

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  if (screen === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-xl font-bold">Game not found</p>
      </div>
    )
  }

  if (screen === 'join') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card p-6 w-full max-w-md space-y-5">
          <div className="text-center space-y-1">
            <div className="text-4xl">{cfg.headerEmoji}</div>
            <h1 className="text-2xl font-black gradient-title">{game?.title}</h1>
            <GameTypeBadge gameType="two_truths" />
          </div>
          <input
            type="text"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && joinGame()}
            placeholder="Your name"
            className="input-field w-full"
            maxLength={40}
          />
          <button type="button" onClick={joinGame} disabled={!joinName.trim() || joining} className="btn-primary w-full">
            {joining ? 'Joining…' : 'Join game'}
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'lobby' && myPlayerId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="glass-card p-6 w-full max-w-lg space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black">Lobby</h2>
            <p className="text-muted text-sm">Playing as {myPlayerName}</p>
          </div>
          {myStatement ? (
            <div className="space-y-4">
              <p className="text-center text-sm text-emerald-700 dark:text-emerald-200 font-semibold">
                ✓ Statements saved — waiting for the host to start
              </p>
              <TwoTruthsLobbySubmit
                gameCode={gameCode}
                playerId={myPlayerId}
                existingLieIndex={myStatement.lie_index}
                existingStatements={existingStatements}
                onSaved={load}
              />
            </div>
          ) : (
            <TwoTruthsLobbySubmit gameCode={gameCode} playerId={myPlayerId} onSaved={load} />
          )}
        </div>
      </div>
    )
  }

  if (screen === 'playing' && game && myPlayerId) {
    return (
      <div className="min-h-screen pb-16">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div className="text-center space-y-1">
            <div className="text-3xl">{cfg.headerEmoji}</div>
            <h1 className="text-xl font-black gradient-title">{game.title}</h1>
          </div>
          <TwoTruthsActiveRound
            gameCode={gameCode}
            game={game}
            players={players}
            rounds={rounds}
            guesses={guesses}
            myPlayerId={myPlayerId}
            playerName={myPlayerName}
            onReload={load}
          />
        </div>
      </div>
    )
  }

  return null
}
