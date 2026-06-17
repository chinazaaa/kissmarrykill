'use client'

import { useCallback, useEffect, useState } from 'react'
import { CopyLinkButton } from '@/components/ui/CopyLinkButton'
import { gameTypeConfig } from '@/lib/game-types'
import { currentPlayerId, LUDO_MIN_PLAYERS } from '@/lib/ludo'
import { supabase } from '@/lib/supabase'
import { GAME_SELECT, LUDO_PLAYER_STATE_SELECT, LUDO_SESSION_SELECT, PLAYER_SELECT } from '@/lib/supabase-selects'
import { appOrigin } from '@/lib/site'
import { useHostRemovePlayer } from '@/hooks/useHostRemovePlayer'
import { HostPlayerManageList } from '@/components/host/HostPlayerManageList'
import type { Game, LudoPlayerState, LudoSession, Player } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { POLL_INTERVALS, supabasePollOk, usePolling } from '@/hooks/usePolling'
import { useApplyGameTheme } from '@/hooks/useApplyGameTheme'
import { HostLateJoinSettingsCard } from '@/components/HostLateJoinSettingsCard'
import { GameRulesLink } from '@/components/ui/GameRulesLink'
import { useLudoTurnTimer } from '@/hooks/useLudoTurnTimer'
import { LudoGamePanel } from '@/components/ludo/LudoBoard'
import { LudoPrimaryButton } from '@/components/ludo/LudoChrome'

export function LudoHostView({ gameCode, hostToken }: { gameCode: string; hostToken: string }) {
  const { error: toastError, success } = useToast()
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [session, setSession] = useState<LudoSession | null>(null)
  const [states, setStates] = useState<LudoPlayerState[]>([])
  const [starting, setStarting] = useState(false)
  const [playingAgain, setPlayingAgain] = useState(false)
  const [ending, setEnding] = useState(false)

  useApplyGameTheme(game?.theme)

  const load = useCallback(async (): Promise<boolean> => {
    const [gameRes, plrsRes, sessionRes, statesRes] = await Promise.all([
      supabase.from('games').select(GAME_SELECT).eq('id', gameCode).maybeSingle(),
      supabase.from('players').select(PLAYER_SELECT).eq('game_id', gameCode).order('joined_at'),
      supabase.from('ludo_sessions').select(LUDO_SESSION_SELECT).eq('game_id', gameCode).maybeSingle(),
      supabase.from('ludo_player_state').select(LUDO_PLAYER_STATE_SELECT).eq('game_id', gameCode).order('player_order'),
    ])
    if (!supabasePollOk(gameRes, plrsRes, sessionRes, statesRes)) return false
    setGame(gameRes.data)
    setPlayers(plrsRes.data ?? [])
    setSession(sessionRes.data as LudoSession | null)
    setStates((statesRes.data as LudoPlayerState[]) ?? [])
    return true
  }, [gameCode])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel(`ludo-host-${gameCode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameCode}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ludo_sessions', filter: `game_id=eq.${gameCode}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ludo_player_state', filter: `game_id=eq.${gameCode}` }, () => void load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameCode, load])

  usePolling(() => load(), [gameCode, load], { intervalMs: POLL_INTERVALS.realtimeFallback })

  const { removePlayer, removingPlayerId } = useHostRemovePlayer(gameCode, hostToken, () => void load())

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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to end')
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
      success('Ready for a new game!')
      await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to reset')
    } finally {
      setPlayingAgain(false)
    }
  }

  const cfg = gameTypeConfig('ludo')
  const joinUrl = `${appOrigin()}/game/${gameCode}`
  const canStart = players.filter((p) => p.spectator !== true).length >= LUDO_MIN_PLAYERS
  const turnPlayerId = session ? currentPlayerId(session) : null
  const turnPlayer = players.find((p) => p.id === turnPlayerId)
  const winner = players.find((p) => p.id === session?.winner_player_id)

  const { secondsLeft, hasTimer, urgent } = useLudoTurnTimer(gameCode, session, game?.status === 'active')

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="text-center space-y-1">
          <div className="text-4xl">{cfg.headerEmoji}</div>
          <h1 className="text-2xl font-black tracking-tight gradient-title">{game.title}</h1>
          <p className="text-muted text-sm">{cfg.label} · Host panel</p>
        </div>

        {game.status === 'waiting' && (
          <div className="glass-card-strong p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="label-caps">Share link</p>
              <GameRulesLink gameType="ludo" />
            </div>
            <CopyLinkButton value={joinUrl} label="Copy player link" />
            <HostLateJoinSettingsCard gameCode={gameCode} hostToken={hostToken} game={game} onGameUpdate={setGame} />
            <HostPlayerManageList
              players={players}
              removingPlayerId={removingPlayerId}
              onRemovePlayer={removePlayer}
            />
            <LudoPrimaryButton onClick={startGame} disabled={!canStart} loading={starting}>
              {canStart ? 'Start game' : `Need ${LUDO_MIN_PLAYERS}+ players`}
            </LudoPrimaryButton>
          </div>
        )}

        {game.status === 'active' && session && (
          <LudoGamePanel
            session={session}
            states={states}
            players={players}
            myPlayerId={null}
            isMyTurn={false}
            secondsLeft={secondsLeft}
            hasTimer={hasTimer}
            urgent={urgent}
          />
        )}

        {game.status === 'finished' && (
          <div className="glass-card-strong p-5 space-y-4 text-center">
            <p className="text-2xl font-black">🏆 {winner?.name ?? 'Someone'} wins!</p>
            <LudoPrimaryButton onClick={playAgain} loading={playingAgain}>
              Play again
            </LudoPrimaryButton>
          </div>
        )}

        {game.status === 'active' && (
          <div className="flex gap-2">
            <button type="button" onClick={endGame} disabled={ending} className="btn-secondary flex-1 py-2 text-sm">
              {ending ? 'Ending…' : 'End game'}
            </button>
          </div>
        )}

        {game.status !== 'waiting' && (
          <HostPlayerManageList
            players={players}
            removingPlayerId={removingPlayerId}
            onRemovePlayer={game.status === 'active' ? removePlayer : undefined}
          />
        )}
      </div>
    </div>
  )
}
