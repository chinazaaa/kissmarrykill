'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CodewordsBoardGrid, CodewordsTeamBadge } from '@/components/codewords/CodewordsBoardGrid'
import { CopyLinkButton } from '@/components/ui/CopyLinkButton'
import { gameTypeConfig } from '@/lib/game-types'
import { CODEWORDS_MIN_PLAYERS, codewordsMaxPlayers, lobbyReady, teamLabel } from '@/lib/codewords'
import { supabase } from '@/lib/supabase'
import { appOrigin } from '@/lib/site'
import type { CodewordsBoard, CodewordsPlayerRole, Game, Player } from '@/types'
import { useToast } from '@/components/ui/Toast'

export function CodewordsHostView({ gameCode, hostToken }: { gameCode: string; hostToken: string }) {
  const router = useRouter()
  const { error: toastError, success } = useToast()
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [roles, setRoles] = useState<CodewordsPlayerRole[]>([])
  const [board, setBoard] = useState<CodewordsBoard | null>(null)
  const [starting, setStarting] = useState(false)
  const [playingAgain, setPlayingAgain] = useState(false)

  const load = useCallback(async () => {
    const [{ data: gameData }, { data: plrs }, { data: roleRows }, { data: boardData }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameCode).maybeSingle(),
      supabase.from('players').select('*').eq('game_id', gameCode).order('joined_at'),
      supabase.from('codewords_player_roles').select('*').eq('game_id', gameCode),
      supabase.from('codewords_boards').select('*').eq('game_id', gameCode).maybeSingle(),
    ])
    if (gameData) setGame(gameData)
    setPlayers(plrs ?? [])
    setRoles(roleRows ?? [])
    setBoard(boardData as CodewordsBoard | null)
  }, [gameCode])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel(`codewords-host-${gameCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameCode}` }, (p) =>
        setGame(p.new as Game)
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `game_id=eq.${gameCode}` }, (p) => {
        const player = p.new as Player
        setPlayers((prev) => (prev.some((x) => x.id === player.id) ? prev : [...prev, player]))
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'codewords_player_roles', filter: `game_id=eq.${gameCode}` },
        () => {
          void load()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'codewords_boards', filter: `game_id=eq.${gameCode}` },
        (p) => setBoard(p.new as CodewordsBoard)
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
      await load()
      success('Codewords started!')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to start')
    } finally {
      setStarting(false)
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
      await load()
      success('Lobby reopened — pick teams again!')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to reset')
    } finally {
      setPlayingAgain(false)
    }
  }

  const cfg = gameTypeConfig('codewords')
  const ready = lobbyReady(roles)
  const playerLink = `${appOrigin()}/game/${gameCode}`

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="text-center space-y-1">
          <div className="text-4xl">{cfg.headerEmoji}</div>
          <h1 className="text-2xl font-black tracking-tight gradient-title">{game.title}</h1>
          <p className="text-muted text-sm">{cfg.label} · Host panel</p>
        </div>

        <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-faint text-xs uppercase tracking-wider">Share with players</p>
            <p className="font-mono font-bold text-lg">{gameCode}</p>
          </div>
          <CopyLinkButton value={playerLink} label="Copy player link" />
        </div>

        {game.status === 'waiting' && (
          <div className="glass-card p-5 space-y-4">
            <p className="label-caps">Lobby ({players.length}/{codewordsMaxPlayers(game)})</p>
            <ul className="space-y-2">
              {players.map((p) => {
                const role = roles.find((r) => r.player_id === p.id)
                return (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{p.name}</span>
                    {role ? (
                      <span className="text-faint text-xs">
                        <CodewordsTeamBadge team={role.team} /> · {role.role}
                      </span>
                    ) : (
                      <span className="text-faint text-xs">Picking team…</span>
                    )}
                  </li>
                )
              })}
            </ul>
            {!ready.ok && players.length >= CODEWORDS_MIN_PLAYERS && (
              <p className="text-amber-700 dark:text-amber-200 text-sm">{ready.error}</p>
            )}
            <button
              type="button"
              onClick={startGame}
              disabled={starting || players.length < CODEWORDS_MIN_PLAYERS || !ready.ok}
              className="btn-primary w-full"
            >
              {starting ? 'Starting…' : `Start game (${CODEWORDS_MIN_PLAYERS}+ players, teams ready)`}
            </button>
          </div>
        )}

        {board && game.status === 'active' && (
          <div className="glass-card p-5 space-y-4">
            <p className="text-center text-sm text-muted">
              <CodewordsTeamBadge team={board.current_turn} /> team&apos;s turn
              {board.current_clue_word && (
                <>
                  {' '}
                  · Clue: <strong>{board.current_clue_word}</strong> {board.current_clue_number}
                </>
              )}
            </p>
            <CodewordsBoardGrid board={board} showKey />
          </div>
        )}

        {board && game.status === 'finished' && board.winner && (
          <div className="glass-card p-8 text-center space-y-2 border-amber-400/40">
            <p className="text-4xl">🏆</p>
            <p className="text-2xl font-black">{teamLabel(board.winner)} team wins!</p>
            {board.assassin_team && (
              <p className="text-muted text-sm">{teamLabel(board.assassin_team)} hit the assassin</p>
            )}
          </div>
        )}

        {game.status === 'finished' && (
          <button type="button" onClick={playAgain} disabled={playingAgain} className="btn-secondary w-full">
            {playingAgain ? 'Resetting…' : 'Play again'}
          </button>
        )}

        <button type="button" onClick={() => router.push('/')} className="btn-ghost w-full text-muted">
          Back home
        </button>
      </div>
    </div>
  )
}
