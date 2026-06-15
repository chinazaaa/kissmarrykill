'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MonopolyClassicBoard,
  MonopolyDiceRoll,
  MonopolyPlayerList,
} from '@/components/monopoly/MonopolyBoard'
import {
  MonopolyGlassCard,
  MonopolyLoadingScreen,
  MonopolyPrimaryButton,
  MonopolySecondaryButton,
  MonopolyShell,
  MonopolyStatusBanner,
  MonopolyTurnStrip,
} from '@/components/monopoly/MonopolyChrome'
import { CopyLinkButton } from '@/components/ui/CopyLinkButton'
import { gameTypeConfig } from '@/lib/game-types'
import { currentPlayerId, MONOPOLY_MIN_PLAYERS } from '@/lib/monopoly'
import { supabase } from '@/lib/supabase'
import {
  GAME_SELECT,
  MONOPOLY_BOARD_SELECT,
  MONOPOLY_PLAYER_STATE_SELECT,
  PLAYER_SELECT,
} from '@/lib/supabase-selects'
import { appOrigin } from '@/lib/site'
import type { Game, MonopolyBoard, MonopolyPlayerState, Player } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { POLL_INTERVALS, supabasePollOk, usePolling } from '@/hooks/usePolling'
import { useApplyGameTheme } from '@/hooks/useApplyGameTheme'

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

  useApplyGameTheme(game?.theme)

  const load = useCallback(async (): Promise<boolean> => {
    const [gameRes, plrsRes, boardRes, stateRes] = await Promise.all([
      supabase.from('games').select(GAME_SELECT).eq('id', gameCode).maybeSingle(),
      supabase.from('players').select(PLAYER_SELECT).eq('game_id', gameCode).order('joined_at'),
      supabase.from('monopoly_boards').select(MONOPOLY_BOARD_SELECT).eq('game_id', gameCode).maybeSingle(),
      supabase.from('monopoly_player_state').select(MONOPOLY_PLAYER_STATE_SELECT).eq('game_id', gameCode).order('player_order'),
    ])
    if (!supabasePollOk(gameRes, plrsRes, boardRes, stateRes)) return false
    setGame(gameRes.data)
    setPlayers(plrsRes.data ?? [])
    setBoard(boardRes.data as MonopolyBoard | null)
    setStates((stateRes.data as MonopolyPlayerState[]) ?? [])
    return true
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

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameCode, load])

  usePolling(() => load(), [gameCode, load], { intervalMs: POLL_INTERVALS.realtimeFallback })

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

  if (!game) return <MonopolyLoadingScreen />

  return (
    <MonopolyShell
      title={game.title}
      subtitle={`${cfg.label} · Room ${gameCode}`}
    >
      <CopyLinkButton
        value={joinUrl}
        label="Copy player link"
        className="w-full !rounded-2xl !border-[var(--border-strong)] !bg-[var(--card)] !text-[var(--foreground)] hover:!bg-[var(--card-hover)]"
      />

      {game.status === 'waiting' && (
        <>
          <MonopolyGlassCard className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-faint">Lobby</p>
                <p className="text-2xl font-black text-[var(--foreground)]">
                  {players.length} <span className="text-lg font-semibold text-muted">/ 6 players</span>
                </p>
              </div>
              <div className="text-4xl">🎩</div>
            </div>
            <div className="space-y-2">
              {players.length === 0 ? (
                <p className="text-sm text-faint text-center py-4">Waiting for players to join…</p>
              ) : (
                players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl bg-[var(--surface-inset-bg)] px-3 py-2.5 border border-[var(--border-strong)]"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary)_25%,transparent)] text-sm font-bold text-[var(--foreground)]">
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="font-semibold text-[var(--foreground)]">{p.name}</span>
                  </div>
                ))
              )}
            </div>
            {!canStart && (
              <p className="text-sm text-[var(--marry)] text-center">
                Need at least {MONOPOLY_MIN_PLAYERS} players to start
              </p>
            )}
          </MonopolyGlassCard>
          <MonopolyPrimaryButton onClick={startGame} disabled={!canStart} loading={starting} variant="gold">
            Start Monopoly
          </MonopolyPrimaryButton>
        </>
      )}

      {game.status === 'active' && board && (
        <>
          <MonopolyTurnStrip turnName={turnPlayer?.name ?? '—'} phase={board.phase} />
          {board.status_message && <MonopolyStatusBanner message={board.status_message} />}

          <MonopolyClassicBoard
            states={states}
            players={players}
            propertyOwners={board.property_owners}
            center={
              <div className="flex flex-col items-center justify-center h-full gap-1">
                <MonopolyDiceRoll dice={board.last_dice} />
                <p className="text-[10px] uppercase tracking-widest text-faint mt-1">Host view</p>
              </div>
            }
          />

          <MonopolyPlayerList
            states={states}
            players={players}
            currentPlayerId={turnPlayerId}
            propertyOwners={board.property_owners}
          />

          <MonopolySecondaryButton onClick={finishGame} disabled={ending}>
            {ending ? 'Ending…' : 'End game early'}
          </MonopolySecondaryButton>
        </>
      )}

      {game.status === 'finished' && (
        <>
          <MonopolyGlassCard glow="accent" className="py-10 text-center">
            <div className="text-6xl mb-3">🏆</div>
            <p className="text-2xl font-black text-[var(--marry)]">{winner ? `${winner.name} wins!` : 'Game over'}</p>
          </MonopolyGlassCard>
          <MonopolyPlayerList
            states={states}
            players={players}
            propertyOwners={board?.property_owners}
          />
          <MonopolyPrimaryButton onClick={playAgain} loading={playingAgain} variant="gold">
            Play again
          </MonopolyPrimaryButton>
        </>
      )}

      <MonopolySecondaryButton onClick={() => router.push('/create')}>Create another game</MonopolySecondaryButton>
    </MonopolyShell>
  )
}
