'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MonopolyBoardGrid,
  MonopolyCurrentSpace,
  MonopolyPlayerList,
} from '@/components/monopoly/MonopolyBoard'
import { GameTypeBadge } from '@/components/GameTypeBadge'
import { CopyLinkButton } from '@/components/ui/CopyLinkButton'
import { gameTypeConfig } from '@/lib/game-types'
import {
  currentPlayerId,
  formatDice,
  MONOPOLY_JAIL_FINE,
  MONOPOLY_MIN_PLAYERS,
  parsePropertyOwners,
  spaceAt,
} from '@/lib/monopoly'
import { supabase } from '@/lib/supabase'
import { appOrigin } from '@/lib/site'
import { getPlayerSession, setPlayerSession, clearPlayerSession } from '@/lib/utils'
import type { Game, MonopolyBoard, MonopolyPlayerState, Player } from '@/types'
import { useToast } from '@/components/ui/Toast'

type Screen = 'loading' | 'join' | 'waiting' | 'active' | 'finished' | 'not_found'

export function MonopolyPlayerView({ gameCode }: { gameCode: string }) {
  const router = useRouter()
  const { error: toastError } = useToast()
  const [screen, setScreen] = useState<Screen>('loading')
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [board, setBoard] = useState<MonopolyBoard | null>(null)
  const [states, setStates] = useState<MonopolyPlayerState[]>([])
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [joinName, setJoinName] = useState('')
  const [joining, setJoining] = useState(false)
  const [acting, setActing] = useState(false)

  const syncScreen = useCallback((gameData: Game, playerId: string | null) => {
    if (gameData.status === 'waiting') {
      setScreen(playerId ? 'waiting' : 'join')
      return
    }
    if (gameData.status === 'active') {
      setScreen(playerId ? 'active' : 'join')
      return
    }
    setScreen(playerId ? 'finished' : 'join')
  }, [])

  const load = useCallback(async () => {
    const [{ data: gameData }, { data: plrs }, { data: boardData }, { data: stateRows }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameCode).maybeSingle(),
      supabase.from('players').select('*').eq('game_id', gameCode).order('joined_at'),
      supabase.from('monopoly_boards').select('*').eq('game_id', gameCode).maybeSingle(),
      supabase.from('monopoly_player_state').select('*').eq('game_id', gameCode).order('player_order'),
    ])

    if (!gameData) {
      setScreen('not_found')
      return
    }

    setGame(gameData)
    setPlayers(plrs ?? [])
    setBoard(boardData as MonopolyBoard | null)
    setStates((stateRows as MonopolyPlayerState[]) ?? [])

    const session = getPlayerSession(gameCode)
    let playerId = session?.playerId ?? null
    if (session && plrs && !plrs.some((p) => p.id === session.playerId)) {
      clearPlayerSession(gameCode)
      playerId = null
      setMyPlayerId(null)
    } else if (session) {
      setMyPlayerId(session.playerId)
    }
    syncScreen(gameData, playerId)
  }, [gameCode, syncScreen])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel(`monopoly-player-${gameCode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameCode}` }, () =>
        void load()
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

  const join = async () => {
    if (!joinName.trim()) return
    setJoining(true)
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameCode, playerName: joinName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to join')
      setPlayerSession(gameCode, data.playerId, data.playerName, 'both')
      setMyPlayerId(data.playerId)
      await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to join')
    } finally {
      setJoining(false)
    }
  }

  const postAction = async (url: string, body: Record<string, unknown>) => {
    if (!myPlayerId) return
    setActing(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: gameCode, playerId: myPlayerId, ...body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Action failed')
      await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActing(false)
    }
  }

  const cfg = gameTypeConfig('monopoly')
  const myState = states.find((s) => s.player_id === myPlayerId)
  const turnPlayerId = board ? currentPlayerId(board) : null
  const isMyTurn = turnPlayerId === myPlayerId && !myState?.bankrupt
  const turnPlayer = players.find((p) => p.id === turnPlayerId)
  const pendingSpace = board?.pending_space != null ? spaceAt(board.pending_space) : null
  const owners = parsePropertyOwners(board?.property_owners)

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted animate-pulse">Loading…</p>
      </div>
    )
  }

  if (screen === 'not_found') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-xl font-bold">Game not found</p>
        <button type="button" onClick={() => router.push('/')} className="btn-primary">
          Home
        </button>
      </div>
    )
  }

  if (screen === 'join') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md card p-6 space-y-4">
          <div className="text-center space-y-1">
            <div className="text-4xl">{cfg.headerEmoji}</div>
            <h1 className="text-2xl font-black">{game?.title}</h1>
            <GameTypeBadge gameType="monopoly" />
          </div>
          <input
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Your name"
            className="input-field w-full"
            maxLength={40}
          />
          <button type="button" onClick={join} disabled={joining || !joinName.trim()} className="btn-primary w-full">
            {joining ? 'Joining…' : 'Join game'}
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'waiting') {
    return (
      <div className="min-h-screen p-4 max-w-lg mx-auto space-y-4">
        <div className="text-center space-y-1 pt-4">
          <div className="text-4xl">{cfg.headerEmoji}</div>
          <h1 className="text-2xl font-black">{game?.title}</h1>
          <GameTypeBadge gameType="monopoly" />
          <p className="text-muted text-sm">Waiting for the host to start…</p>
        </div>
        <MonopolyPlayerList states={states} players={players} propertyOwners={{}} />
        <p className="text-center text-faint text-sm">
          {players.length} player{players.length === 1 ? '' : 's'} joined (need {MONOPOLY_MIN_PLAYERS}+)
        </p>
      </div>
    )
  }

  if (screen === 'finished') {
    const winner = players.find((p) => p.id === board?.winner_player_id)
    return (
      <div className="min-h-screen p-4 max-w-lg mx-auto space-y-4">
        <div className="text-center space-y-2 pt-4">
          <div className="text-5xl">🏆</div>
          <h1 className="text-2xl font-black">Game over!</h1>
          {winner && <p className="text-lg">{winner.name} wins!</p>}
        </div>
        <MonopolyPlayerList
          states={states}
          players={players}
          propertyOwners={board?.property_owners}
        />
        <button type="button" onClick={() => router.push('/')} className="btn-secondary w-full">
          Back home
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto space-y-4 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <GameTypeBadge gameType="monopoly" />
          <h1 className="text-xl font-black mt-1">{game?.title}</h1>
          {board?.status_message && <p className="text-sm text-muted mt-1">{board.status_message}</p>}
        </div>
        {myState && (
          <div className="text-right">
            <p className="text-xs text-faint">Your cash</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-300">${myState.cash}</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-inset-bg)] p-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-faint uppercase">Current turn</p>
          <p className="font-bold">{turnPlayer?.name ?? '—'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-faint">Last roll</p>
          <p className="font-bold font-mono">{formatDice(board?.last_dice ?? null)}</p>
        </div>
      </div>

      {myState && <MonopolyCurrentSpace index={myState.position} />}

      {isMyTurn && board?.phase === 'roll' && !myState?.in_jail && (
        <button
          type="button"
          disabled={acting}
          onClick={() => postAction('/api/monopoly/roll', {})}
          className="btn-primary w-full text-lg py-4"
        >
          {acting ? 'Rolling…' : '🎲 Roll dice'}
        </button>
      )}

      {isMyTurn && board?.phase === 'jail' && myState?.in_jail && (
        <div className="space-y-2">
          <p className="text-sm text-center text-muted">You are in jail — roll for doubles, pay, or use a card.</p>
          <button
            type="button"
            disabled={acting}
            onClick={() => postAction('/api/monopoly/roll', {})}
            className="btn-primary w-full"
          >
            Roll for doubles
          </button>
          <button
            type="button"
            disabled={acting || (myState?.cash ?? 0) < MONOPOLY_JAIL_FINE}
            onClick={() => postAction('/api/monopoly/jail', { method: 'pay' })}
            className="btn-secondary w-full"
          >
            Pay ${MONOPOLY_JAIL_FINE}
          </button>
          {(myState?.get_out_of_jail_free ?? 0) > 0 && (
            <button
              type="button"
              disabled={acting}
              onClick={() => postAction('/api/monopoly/jail', { method: 'card' })}
              className="btn-secondary w-full"
            >
              Use Get Out of Jail Free card
            </button>
          )}
        </div>
      )}

      {isMyTurn && board?.phase === 'buy' && pendingSpace && (
        <div className="space-y-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="font-bold text-center">
            Buy {pendingSpace.name} for ${pendingSpace.price}?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={acting || (myState?.cash ?? 0) < (pendingSpace.price ?? 0)}
              onClick={() => postAction('/api/monopoly/buy', { buy: true })}
              className="btn-primary"
            >
              Buy
            </button>
            <button
              type="button"
              disabled={acting}
              onClick={() => postAction('/api/monopoly/buy', { buy: false })}
              className="btn-secondary"
            >
              Pass
            </button>
          </div>
        </div>
      )}

      <MonopolyPlayerList
        states={states}
        players={players}
        currentPlayerId={turnPlayerId}
        propertyOwners={owners}
      />

      <details className="rounded-xl border border-[var(--border-strong)]">
        <summary className="cursor-pointer p-3 font-semibold text-sm">Board map</summary>
        <div className="p-3 pt-0">
          <MonopolyBoardGrid
            states={states}
            players={players}
            propertyOwners={owners}
            highlightIndex={myState?.position}
          />
        </div>
      </details>
    </div>
  )
}
