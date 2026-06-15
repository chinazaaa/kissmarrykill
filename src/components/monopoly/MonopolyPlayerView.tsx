'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MonopolyClassicBoard,
  MonopolyCurrentSpace,
  MonopolyDiceRoll,
  MonopolyMyProperties,
  MonopolyPlayerList,
} from '@/components/monopoly/MonopolyBoard'
import { MONOPOLY_COLOR_CLASSES } from '@/lib/monopoly'
import type { MonopolyColorGroup } from '@/lib/monopoly'
import {
  MonopolyCashBadge,
  MonopolyGlassCard,
  MonopolyLoadingScreen,
  MonopolyModal,
  MonopolyPrimaryButton,
  MonopolySecondaryButton,
  MonopolyShell,
  MonopolyStatusBanner,
  MonopolyTurnStrip,
} from '@/components/monopoly/MonopolyChrome'
import { gameTypeConfig } from '@/lib/game-types'
import {
  computeRent,
  currentPlayerId,
  MONOPOLY_JAIL_FINE,
  MONOPOLY_MIN_PLAYERS,
  parsePropertyOwners,
  spaceAt,
} from '@/lib/monopoly'
import { supabase } from '@/lib/supabase'
import { getPlayerSession, setPlayerSession, clearPlayerSession } from '@/lib/utils'
import type { Game, MonopolyBoard, MonopolyPlayerState, Player } from '@/types'
import { useToast } from '@/components/ui/Toast'

type Screen = 'loading' | 'join' | 'waiting' | 'active' | 'finished' | 'not_found'

function colorBarClass(color?: MonopolyColorGroup): string {
  if (!color) return 'bg-neutral-500'
  return MONOPOLY_COLOR_CLASSES[color] ?? 'bg-neutral-500'
}

export function MonopolyPlayerView({ gameCode }: { gameCode: string }) {
  const router = useRouter()
  const { error: toastError } = useToast()
  const [screen, setScreen] = useState<Screen>('loading')
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [board, setBoard] = useState<MonopolyBoard | null>(null)
  const [states, setStates] = useState<MonopolyPlayerState[]>([])
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [myPlayerName, setMyPlayerName] = useState<string | null>(null)
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
      setMyPlayerName(null)
    } else if (session) {
      setMyPlayerId(session.playerId)
      setMyPlayerName(session.playerName)
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
      setMyPlayerName(data.playerName)
      await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to join')
    } finally {
      setJoining(false)
    }
  }

  const postAction = async (url: string, body: Record<string, unknown> = {}) => {
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
  const currentOwner =
    myState != null ? players.find((p) => p.id === owners[String(myState.position)])?.name : null

  const rentOwnerId =
    board?.phase === 'pay_rent' && board.pending_space != null
      ? owners[String(board.pending_space)]
      : null
  const rentOwner = rentOwnerId ? players.find((p) => p.id === rentOwnerId) : null
  const rentAmount =
    pendingSpace && rentOwnerId
      ? computeRent(pendingSpace, owners, rentOwnerId, board?.last_dice?.total ?? 2)
      : 0

  const showBuyModal = !!(isMyTurn && board?.phase === 'buy' && pendingSpace != null)
  const showRentModal = !!(isMyTurn && board?.phase === 'pay_rent' && pendingSpace != null)
  const showJailModal = !!(isMyTurn && board?.phase === 'jail' && myState?.in_jail)

  if (screen === 'loading') return <MonopolyLoadingScreen />

  if (screen === 'not_found') {
    return (
      <MonopolyShell title="Game not found">
        <MonopolyPrimaryButton onClick={() => router.push('/')}>Back home</MonopolyPrimaryButton>
      </MonopolyShell>
    )
  }

  if (screen === 'join') {
    return (
      <MonopolyShell title={game?.title ?? cfg.label} subtitle="Enter your name to take a seat at the table">
        <MonopolyGlassCard glow="emerald" className="p-6 sm:p-8 space-y-5 max-w-md mx-auto">
          <div className="text-center">
            <div className="text-5xl mb-3">🎲</div>
            <p className="text-sm text-emerald-100/70">2–6 players · $1,500 starting cash</p>
          </div>
          <input
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3.5 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            maxLength={40}
            onKeyDown={(e) => e.key === 'Enter' && join()}
          />
          <MonopolyPrimaryButton onClick={join} disabled={!joinName.trim()} loading={joining}>
            Take my seat
          </MonopolyPrimaryButton>
        </MonopolyGlassCard>
      </MonopolyShell>
    )
  }

  if (screen === 'waiting') {
    return (
      <MonopolyShell title={game?.title} subtitle="The host will start the game when everyone is ready">
        <MonopolyGlassCard className="p-4 text-center">
          <p className="text-3xl font-black text-emerald-300">{players.length}</p>
          <p className="text-sm text-emerald-100/60">
            player{players.length === 1 ? '' : 's'} joined · need {MONOPOLY_MIN_PLAYERS}+
          </p>
        </MonopolyGlassCard>
        <div className="space-y-2">
          {players.map((p) => (
            <MonopolyGlassCard key={p.id} className="px-4 py-3 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/30 text-sm font-bold text-white">
                {p.name.charAt(0).toUpperCase()}
              </span>
              <span className="font-semibold text-white">{p.name}</span>
              {p.id === myPlayerId && (
                <span className="ml-auto text-[10px] font-bold uppercase text-sky-300">You</span>
              )}
            </MonopolyGlassCard>
          ))}
        </div>
      </MonopolyShell>
    )
  }

  if (screen === 'finished') {
    const winner = players.find((p) => p.id === board?.winner_player_id)
    return (
      <MonopolyShell title="Game over!" subtitle={winner ? `${winner.name} takes the crown` : undefined}>
        <MonopolyGlassCard glow="amber" className="py-10 text-center">
          <div className="text-6xl mb-3 drop-shadow-lg">🏆</div>
          {winner && <p className="text-2xl font-black text-amber-300">{winner.name}</p>}
          <p className="text-sm text-emerald-100/60 mt-1">Monopoly champion</p>
        </MonopolyGlassCard>
        <MonopolyPlayerList
          states={states}
          players={players}
          propertyOwners={board?.property_owners}
          myPlayerId={myPlayerId}
        />
        <MonopolySecondaryButton onClick={() => router.push('/')}>Back home</MonopolySecondaryButton>
      </MonopolyShell>
    )
  }

  return (
    <MonopolyShell title={game?.title}>
      <div className="flex items-start justify-between gap-3">
        <MonopolyTurnStrip
          turnName={turnPlayer?.name ?? '—'}
          isMyTurn={isMyTurn}
          phase={board?.phase}
          myName={myPlayerName ?? players.find((p) => p.id === myPlayerId)?.name}
        />
        {myState && <MonopolyCashBadge amount={myState.cash} />}
      </div>

      {board?.status_message && !showBuyModal && !showRentModal && (
        <MonopolyStatusBanner message={board.status_message} isMyTurn={isMyTurn} />
      )}

      <MonopolyClassicBoard
        states={states}
        players={players}
        propertyOwners={owners}
        highlightIndex={myState?.position}
        center={
          <div className="flex flex-col items-center justify-center h-full gap-2 px-1">
            <MonopolyDiceRoll dice={board?.last_dice} rolling={acting} />
            {isMyTurn && board?.phase === 'roll' && !myState?.in_jail && (
              <button
                type="button"
                disabled={acting}
                onClick={() => postAction('/api/monopoly/roll')}
                className="rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-2 text-xs font-black text-amber-950 shadow-md disabled:opacity-50"
              >
                {acting ? '…' : '🎲 Roll'}
              </button>
            )}
          </div>
        }
      />

      {myState && (
        <MonopolyCurrentSpace index={myState.position} ownerName={currentOwner} />
      )}

      {myPlayerId && (
        <MonopolyMyProperties
          playerId={myPlayerId}
          propertyOwners={owners}
          players={players}
        />
      )}

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-200/50 mb-2 px-1">
          All players
        </p>
        <MonopolyPlayerList
          states={states}
          players={players}
          currentPlayerId={turnPlayerId}
          propertyOwners={owners}
          myPlayerId={myPlayerId}
        />
      </div>

      {/* Buy property modal */}
      <MonopolyModal
        open={showBuyModal}
        subtitle="Property available"
        title={pendingSpace?.name ?? ''}
        colorBar={pendingSpace?.color ? colorBarClass(pendingSpace.color) : undefined}
      >
        <p className="text-center text-3xl font-black text-amber-400">${pendingSpace?.price}</p>
        {pendingSpace?.rent != null && (
          <p className="text-center text-sm text-emerald-100/70">Rent ${pendingSpace.rent}</p>
        )}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <MonopolyPrimaryButton
            onClick={() => postAction('/api/monopoly/buy', { buy: true })}
            loading={acting}
            disabled={(myState?.cash ?? 0) < (pendingSpace?.price ?? 0)}
          >
            Buy
          </MonopolyPrimaryButton>
          <MonopolySecondaryButton
            onClick={() => postAction('/api/monopoly/buy', { buy: false })}
            disabled={acting}
          >
            Pass
          </MonopolySecondaryButton>
        </div>
      </MonopolyModal>

      {/* Pay rent modal */}
      <MonopolyModal
        open={showRentModal}
        subtitle="Rent due"
        title={pendingSpace?.name ?? ''}
        colorBar={pendingSpace?.color ? colorBarClass(pendingSpace.color) : undefined}
      >
        <p className="text-center text-sm text-emerald-100/80">
          Owned by <span className="font-bold text-white">{rentOwner?.name ?? 'another player'}</span>
        </p>
        <p className="text-center text-3xl font-black text-red-400">${rentAmount}</p>
        <MonopolyPrimaryButton
          onClick={() => postAction('/api/monopoly/rent')}
          loading={acting}
          disabled={(myState?.cash ?? 0) < rentAmount}
        >
          Pay ${rentAmount}
        </MonopolyPrimaryButton>
      </MonopolyModal>

      {/* Jail modal */}
      <MonopolyModal open={showJailModal} subtitle="In jail" title="🔒 Roll, pay, or use a card">
        <div className="space-y-2">
          <MonopolyPrimaryButton onClick={() => postAction('/api/monopoly/roll')} loading={acting}>
            Roll for doubles
          </MonopolyPrimaryButton>
          <MonopolySecondaryButton
            onClick={() => postAction('/api/monopoly/jail', { method: 'pay' })}
            disabled={acting || (myState?.cash ?? 0) < MONOPOLY_JAIL_FINE}
          >
            Pay ${MONOPOLY_JAIL_FINE} fine
          </MonopolySecondaryButton>
          {(myState?.get_out_of_jail_free ?? 0) > 0 && (
            <MonopolySecondaryButton
              onClick={() => postAction('/api/monopoly/jail', { method: 'card' })}
              disabled={acting}
            >
              Use Get Out of Jail Free card
            </MonopolySecondaryButton>
          )}
        </div>
      </MonopolyModal>
    </MonopolyShell>
  )
}
