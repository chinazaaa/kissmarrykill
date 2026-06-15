'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MonopolyBoardGrid,
  MonopolyPlayerList,
} from '@/components/monopoly/MonopolyBoard'
import { CopyLinkButton } from '@/components/ui/CopyLinkButton'
import { gameTypeConfig } from '@/lib/game-types'
import { currentPlayerId, MONOPOLY_MIN_PLAYERS, formatDice } from '@/lib/monopoly'
import { supabase } from '@/lib/supabase'
import { appOrigin } from '@/lib/site'
import type { Game, MonopolyBoard, MonopolyPlayerState, Player } from '@/types'
import { useToast } from '@/components/ui/Toast'

export function MonopolyHostView({ gameCode, hostToken }: { gameCode: string; hostToken: string }) {
  const router = useRouter()
  const { error: toastError, success } = useToast()
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [board, setBoard] = useState<MonopolyBoard | null>(null)
  const [states, setStates] = useState<MonopolyPlayerState[]>([])
  const [starting, setStarting] = useState(false)
  const [playingAgain, setPlayingAgain] = useState(false)
  const [ending, setEnding] = useState(false)

  const load = useCallback(async () => {
    const [{ data: gameData }, { data: plrs }, { data: boardData }, { data: stateRows }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameCode).maybeSingle(),
      supabase.from('players').select('*').eq('game_id', gameCode).order('joined_at'),
      supabase.from('monopoly_boards').select('*').eq('game_id', gameCode).maybeSingle(),
      supabase.from('monopoly_player_state').select('*').eq('game_id', gameCode).order('player_order'),
    ])
    setGame(gameData)
    setPlayers(plrs ?? [])
    setBoard(boardData as MonopolyBoard | null)
    setStates((stateRows as MonopolyPlayerState[]) ?? [])
  }, [gameCode])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel(`monopoly-host-${gameCode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameCode}` }, () =>
        void load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameCode}` },
        () => void load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'monopoly_boards', filter: `game_id=eq.${gameCode}` },
        () => void load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'monopoly_player_state', filter: `game_id=eq.${gameCode}` },
        () => void load()
      )
      .subscribe()

    const poll = setInterval(load, 4000)
    return () => {
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [gameCode, load])

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

  const finishGame = async () => {
    setEnding(true)
    try {
      const res = await fetch(`/api/games/${gameCode}/finish-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to end game')
      await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to end game')
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
      success('Ready for a new game!')
      await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to reset')
    } finally {
      setPlayingAgain(false)
    }
  }

  const cfg = gameTypeConfig('monopoly')
  const joinUrl = `${appOrigin()}/game/${gameCode}`
  const canStart = players.length >= MONOPOLY_MIN_PLAYERS
  const turnPlayerId = board ? currentPlayerId(board) : null
  const turnPlayer = players.find((p) => p.id === turnPlayerId)
  const winner = players.find((p) => p.id === board?.winner_player_id)

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted animate-pulse">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto space-y-5 pb-24">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{cfg.card.emoji}</span>
          <div>
            <h1 className="text-2xl font-black">{game.title}</h1>
            <p className="text-sm text-muted">{cfg.label} · Code {gameCode}</p>
          </div>
        </div>
        <CopyLinkButton value={joinUrl} label="Copy player link" className="w-full" />
      </div>

      {game.status === 'waiting' && (
        <>
          <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-inset-bg)] p-4 space-y-3">
            <p className="font-bold">
              {players.length} player{players.length === 1 ? '' : 's'} in lobby
            </p>
            <ul className="space-y-1">
              {players.map((p) => (
                <li key={p.id} className="text-sm">
                  {p.name}
                </li>
              ))}
            </ul>
            {!canStart && (
              <p className="text-sm text-amber-600">Need at least {MONOPOLY_MIN_PLAYERS} players to start.</p>
            )}
          </div>
          <button
            type="button"
            onClick={startGame}
            disabled={starting || !canStart}
            className="btn-primary w-full text-lg py-4"
          >
            {starting ? 'Starting…' : 'Start Monopoly'}
          </button>
        </>
      )}

      {game.status === 'active' && board && (
        <>
          <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-inset-bg)] p-4 space-y-2">
            <p className="text-xs text-faint uppercase">Current turn</p>
            <p className="text-xl font-black">{turnPlayer?.name ?? '—'}</p>
            <p className="text-sm text-muted">Phase: {board.phase}</p>
            <p className="text-sm">Last roll: {formatDice(board.last_dice)}</p>
            {board.status_message && <p className="text-sm text-muted">{board.status_message}</p>}
          </div>

          <MonopolyPlayerList
            states={states}
            players={players}
            currentPlayerId={turnPlayerId}
            propertyOwners={board.property_owners}
          />

          <MonopolyBoardGrid
            states={states}
            players={players}
            propertyOwners={board.property_owners}
          />

          <button type="button" onClick={finishGame} disabled={ending} className="btn-secondary w-full">
            {ending ? 'Ending…' : 'End game early'}
          </button>
        </>
      )}

      {game.status === 'finished' && (
        <>
          <div className="text-center space-y-2 py-4">
            <div className="text-5xl">🏆</div>
            <p className="text-xl font-black">{winner ? `${winner.name} wins!` : 'Game over'}</p>
          </div>
          <MonopolyPlayerList
            states={states}
            players={players}
            propertyOwners={board?.property_owners}
          />
          <button type="button" onClick={playAgain} disabled={playingAgain} className="btn-primary w-full">
            {playingAgain ? 'Resetting…' : 'Play again'}
          </button>
        </>
      )}

      <button type="button" onClick={() => router.push('/create')} className="btn-ghost w-full text-sm">
        Create another game
      </button>
    </div>
  )
}
