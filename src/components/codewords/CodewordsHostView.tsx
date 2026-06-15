'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CodewordsActiveRound } from '@/components/codewords/CodewordsActiveRound'
import { CodewordsGuessLog, CodewordsGuessSummary } from '@/components/codewords/CodewordsGuessLog'
import { CodewordsBoardGrid, CodewordsTeamBadge } from '@/components/codewords/CodewordsBoardGrid'
import { CodewordsLobbyRoster } from '@/components/codewords/CodewordsLobbyRoster'
import { CodewordsScoreboard, CodewordsTimerBar } from '@/components/codewords/CodewordsScoreboard'
import { CopyLinkButton } from '@/components/ui/CopyLinkButton'
import { gameTypeConfig } from '@/lib/game-types'
import {
  CODEWORDS_DEFAULT_OPERATIVE_TIMER,
  CODEWORDS_DEFAULT_SPYMASTER_TIMER,
  CODEWORDS_MIN_PLAYERS,
  CODEWORDS_TIMER_OPTIONS,
  codewordsMaxPlayers,
  codewordsPlayerPicks,
  effectiveTurnPhase,
  getCodewordsHostMode,
  guessAttributionMap,
  lobbyReady,
  mergeCodewordsGuesses,
  roleLabel,
  setCodewordsHostMode,
  teamLabel,
  waitingTurnMessage,
  type CodewordsHostMode,
} from '@/lib/codewords'
import { useCodewordsRealtime } from '@/hooks/useCodewordsRealtime'
import { useCodewordsTurnTimer } from '@/hooks/useCodewordsTurnTimer'
import { supabase } from '@/lib/supabase'
import { appOrigin } from '@/lib/site'
import { getPlayerSession, setPlayerSession } from '@/lib/utils'
import type { CodewordsBoard, CodewordsGuess, CodewordsPlayerRole, CodewordsRole, CodewordsTeam, Game, Player } from '@/types'
import { useToast } from '@/components/ui/Toast'

export function CodewordsHostView({ gameCode, hostToken }: { gameCode: string; hostToken: string }) {
  const router = useRouter()
  const { error: toastError, success } = useToast()
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [roles, setRoles] = useState<CodewordsPlayerRole[]>([])
  const [board, setBoard] = useState<CodewordsBoard | null>(null)
  const [guesses, setGuesses] = useState<CodewordsGuess[]>([])
  const [starting, setStarting] = useState(false)
  const [playingAgain, setPlayingAgain] = useState(false)
  const [ending, setEnding] = useState(false)
  const [savingRoleFor, setSavingRoleFor] = useState<string | null>(null)
  const [spymasterTimer, setSpymasterTimer] = useState(CODEWORDS_DEFAULT_SPYMASTER_TIMER)
  const [operativeTimer, setOperativeTimer] = useState(CODEWORDS_DEFAULT_OPERATIVE_TIMER)
  const [savingTimers, setSavingTimers] = useState(false)
  const [hostMode, setHostMode] = useState<CodewordsHostMode>('spectator')
  const [hostPlayerId, setHostPlayerId] = useState<string | null>(null)
  const [hostPlayerName, setHostPlayerName] = useState('')
  const [hostJoinName, setHostJoinName] = useState('')
  const [hostJoining, setHostJoining] = useState(false)
  const [hostPickingTeam, setHostPickingTeam] = useState<CodewordsTeam | null>(null)
  const [hostPickingRole, setHostPickingRole] = useState<CodewordsRole | null>(null)
  const [hostSavingRole, setHostSavingRole] = useState(false)

  const load = useCallback(async () => {
    const [{ data: gameData }, { data: plrs }, { data: roleRows }, { data: boardData }, { data: guessRows }] =
      await Promise.all([
        supabase.from('games').select('*').eq('id', gameCode).maybeSingle(),
        supabase.from('players').select('*').eq('game_id', gameCode).order('joined_at'),
        supabase.from('codewords_player_roles').select('*').eq('game_id', gameCode),
        supabase.from('codewords_boards').select('*').eq('game_id', gameCode).maybeSingle(),
        supabase.from('codewords_guesses').select('*').eq('game_id', gameCode).order('created_at', { ascending: true }),
      ])
    if (gameData) {
      setGame(gameData)
      setSpymasterTimer(gameData.timer_seconds ?? CODEWORDS_DEFAULT_SPYMASTER_TIMER)
      setOperativeTimer(gameData.operative_timer_seconds ?? CODEWORDS_DEFAULT_OPERATIVE_TIMER)
    }
    setPlayers(plrs ?? [])
    setRoles(roleRows ?? [])
    setBoard(boardData as CodewordsBoard | null)
    setGuesses(mergeCodewordsGuesses([], (guessRows as CodewordsGuess[]) ?? []))
  }, [gameCode])

  useEffect(() => {
    load()
    setHostMode(getCodewordsHostMode(gameCode))
    const session = getPlayerSession(gameCode)
    if (session) {
      setHostPlayerId(session.playerId)
      setHostPlayerName(session.playerName)
    }
  }, [gameCode, load])

  useCodewordsRealtime(gameCode, 'host', {
    onGame: setGame,
    onPlayers: (updater) => setPlayers(updater),
    onRoles: (updater) => setRoles(updater),
    onBoard: setBoard,
    onGuesses: (updater) => setGuesses(updater),
    onReload: load,
  })

  useEffect(() => {
    if (!hostPlayerId) return
    const role = roles.find((r) => r.player_id === hostPlayerId) ?? null
    if (role) {
      setHostPickingTeam(role.team)
      setHostPickingRole(role.role)
    }
  }, [hostPlayerId, roles])

  const assignRole = async (playerId: string, team: CodewordsTeam, role: CodewordsRole) => {
    setSavingRoleFor(playerId)
    try {
      const res = await fetch('/api/codewords/host-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: gameCode, hostToken, playerId, team, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update role')
      await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setSavingRoleFor(null)
    }
  }

  const changeHostMode = (mode: CodewordsHostMode) => {
    if (game?.status !== 'waiting') return
    setHostMode(mode)
    setCodewordsHostMode(gameCode, mode)
  }

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

  const hostSaveRole = async () => {
    if (!hostPlayerId || !hostPickingTeam || !hostPickingRole) return
    setHostSavingRole(true)
    try {
      const res = await fetch('/api/codewords/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: gameCode,
          playerId: hostPlayerId,
          team: hostPickingTeam,
          role: hostPickingRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save role')
      await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save role')
    } finally {
      setHostSavingRole(false)
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
      success('Codewords started!')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to start')
    } finally {
      setStarting(false)
    }
  }

  const saveTimers = async () => {
    setSavingTimers(true)
    try {
      const res = await fetch('/api/codewords/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: gameCode,
          hostToken,
          spymasterTimerSeconds: spymasterTimer,
          operativeTimerSeconds: operativeTimer,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update timers')
      if (data.game) setGame(data.game)
      await load()
      success('Timer settings updated')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to update timers')
    } finally {
      setSavingTimers(false)
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
      setBoard(null)
      setGuesses([])
      await load()
      success('Lobby reopened — pick teams again!')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to reset')
    } finally {
      setPlayingAgain(false)
    }
  }

  const endSession = async () => {
    setEnding(true)
    try {
      const res = await fetch(`/api/games/${gameCode}/finish-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to end session')
      await load()
      success('Session closed')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to end session')
    } finally {
      setEnding(false)
    }
  }

  const cfg = gameTypeConfig('codewords')
  const ready = lobbyReady(roles)
  const playerLink = `${appOrigin()}/game/${gameCode}`
  const playersPickTeams = game ? codewordsPlayerPicks(game) : true
  const hostMyRole = hostPlayerId ? roles.find((r) => r.player_id === hostPlayerId) : undefined
  const hostPlays = hostMode === 'player'
  const hostPlayerView = hostPlays && !!hostMyRole && !!board
  const showAdminBoard = !hostPlayerView
  const turnPhase = board ? effectiveTurnPhase(board) : 'clue'
  const { secondsLeft, urgent } = useCodewordsTurnTimer(
    gameCode,
    board,
    game?.status === 'active' && !board?.winner
  )
  const playerNameById = new Map(players.map((p) => [p.id, p.name]))
  const cellAttribution = guessAttributionMap(guesses, playerNameById)
  const turnStatus = board ? waitingTurnMessage(board, roles, playerNameById) : ''

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
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
          <div className="glass-card p-4 space-y-3">
            <p className="label-caps">Your role as host</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => changeHostMode('spectator')}
                className={[
                  'rounded-xl border-2 px-3 py-3 text-left text-sm transition-all',
                  hostMode === 'spectator'
                    ? 'border-[var(--foreground)]/30 bg-[var(--surface-inset-bg)]'
                    : 'border-[var(--border-strong)] text-muted',
                ].join(' ')}
              >
                <span className="font-bold block">Host only</span>
                <span className="text-faint text-xs">See the full board key and manage the game</span>
              </button>
              <button
                type="button"
                onClick={() => changeHostMode('player')}
                className={[
                  'rounded-xl border-2 px-3 py-3 text-left text-sm transition-all',
                  hostMode === 'player'
                    ? 'border-[var(--foreground)]/30 bg-[var(--surface-inset-bg)]'
                    : 'border-[var(--border-strong)] text-muted',
                ].join(' ')}
              >
                <span className="font-bold block">Host + play</span>
                <span className="text-faint text-xs">Join as a player — no secret colour key for you</span>
              </button>
            </div>

            {hostPlays && !hostPlayerId && (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  type="text"
                  value={hostJoinName}
                  onChange={(e) => setHostJoinName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && hostJoinGame()}
                  placeholder="Your player name"
                  className="input-field flex-1"
                  maxLength={40}
                />
                <button
                  type="button"
                  onClick={hostJoinGame}
                  disabled={!hostJoinName.trim() || hostJoining}
                  className="btn-primary sm:w-auto"
                >
                  {hostJoining ? 'Joining…' : 'Join game'}
                </button>
              </div>
            )}

            {hostPlays && hostPlayerId && playersPickTeams && (
              <div className="rounded-xl border border-[var(--border-strong)] p-3 space-y-3">
                <p className="text-xs text-muted">
                  Playing as <strong>{hostPlayerName}</strong> — pick your team & role
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(['red', 'blue'] as const).map((team) => (
                    <button
                      key={team}
                      type="button"
                      onClick={() => setHostPickingTeam(team)}
                      className={[
                        'rounded-lg border px-2 py-2 text-xs font-bold',
                        hostPickingTeam === team
                          ? team === 'red'
                            ? 'border-red-500 bg-red-500/10'
                            : 'border-blue-500 bg-blue-500/10'
                          : 'border-[var(--border-strong)] text-muted',
                      ].join(' ')}
                    >
                      {team === 'red' ? '🔴 Red' : '🔵 Blue'}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['spymaster', 'operative'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setHostPickingRole(role)}
                      className={[
                        'rounded-lg border px-2 py-2 text-xs font-bold',
                        hostPickingRole === role
                          ? 'border-[var(--foreground)]/30'
                          : 'border-[var(--border-strong)] text-muted',
                      ].join(' ')}
                    >
                      {role === 'spymaster' ? '🕵️ Spymaster' : '🎯 Operative'}
                    </button>
                  ))}
                </div>
                {hostMyRole && (
                  <p className="text-xs text-center text-muted">
                    Saved: <CodewordsTeamBadge team={hostMyRole.team} /> {roleLabel(hostMyRole.role)}
                  </p>
                )}
                <button
                  type="button"
                  onClick={hostSaveRole}
                  disabled={!hostPickingTeam || !hostPickingRole || hostSavingRole}
                  className="btn-secondary w-full text-sm"
                >
                  {hostSavingRole ? 'Saving…' : 'Confirm your team & role'}
                </button>
              </div>
            )}

            {hostPlays && hostPlayerId && !playersPickTeams && (
              <p className="text-faint text-xs">
                Playing as <strong>{hostPlayerName}</strong> — assign yourself in the roster below.
              </p>
            )}
          </div>
        )}

        <div className="glass-card p-5 space-y-4">
          <p className="label-caps">Timer settings</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-faint text-xs">Spymaster timer</span>
              <select
                value={spymasterTimer}
                onChange={(e) => setSpymasterTimer(Number(e.target.value))}
                className="input-field w-full"
              >
                {CODEWORDS_TIMER_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s} seconds
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-faint text-xs">Operative timer</span>
              <select
                value={operativeTimer}
                onChange={(e) => setOperativeTimer(Number(e.target.value))}
                className="input-field w-full"
              >
                {CODEWORDS_TIMER_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s} seconds
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={saveTimers}
            disabled={savingTimers}
            className="btn-secondary w-full sm:w-auto"
          >
            {savingTimers ? 'Saving…' : 'Save timer settings'}
          </button>
        </div>

        {(game.status === 'waiting' || game.status === 'active') && (
          <div className="glass-card p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="label-caps">
                  {game.status === 'waiting' ? 'Lobby' : 'Teams'} ({players.length}/{codewordsMaxPlayers(game)})
                </p>
                <p className="text-faint text-xs mt-1">
                  {playersPickTeams
                    ? 'Changes save instantly. Players can also pick their own team in the lobby.'
                    : 'You assign every player — team picks are locked for players.'}
                </p>
              </div>
              {game.status === 'waiting' && players.length >= CODEWORDS_MIN_PLAYERS && (
                <span
                  className={[
                    'text-xs font-semibold rounded-full px-2.5 py-1',
                    ready.ok
                      ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                      : 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
                  ].join(' ')}
                >
                  {ready.ok ? 'Teams ready' : 'Teams incomplete'}
                </span>
              )}
            </div>

            <CodewordsLobbyRoster
              players={players}
              roles={roles}
              savingRoleFor={savingRoleFor}
              onAssign={assignRole}
            />

            {game.status === 'waiting' && (
              <>
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
              </>
            )}
          </div>
        )}

        {board && game.status === 'active' && hostPlayerView && hostMyRole && (
          <div className="glass-card p-5 space-y-3">
            <p className="label-caps">Your game</p>
            <CodewordsActiveRound
              gameCode={gameCode}
              game={game}
              board={board}
              myPlayerId={hostPlayerId!}
              myPlayerName={hostPlayerName}
              myRole={hostMyRole}
              players={players}
              roles={roles}
              guesses={guesses}
              onBoardChange={setBoard}
              onReload={load}
              hideKey
              compactHeader
            />
          </div>
        )}

        {board && game.status === 'active' && showAdminBoard && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">
            <div className="space-y-4">
              {secondsLeft > 0 && (
                <CodewordsTimerBar
                  label={turnPhase === 'clue' ? 'Spymaster timer' : 'Operative timer'}
                  secondsLeft={secondsLeft}
                  urgent={urgent}
                />
              )}
              <div className="glass-card p-5 space-y-4">
                <p className="text-center text-sm text-muted">{turnStatus}</p>
                {board.current_clue_word && (
                  <p className="text-center text-sm">
                    Clue: <strong>{board.current_clue_word}</strong> {board.current_clue_number}
                  </p>
                )}
                <CodewordsBoardGrid board={board} showKey cellAttribution={cellAttribution} />
              </div>
            </div>
            <aside className="space-y-4">
              <CodewordsScoreboard board={board} players={players} roles={roles} />
              <CodewordsGuessSummary guesses={guesses} players={players} />
              <CodewordsGuessLog guesses={guesses} players={players} roles={roles} />
            </aside>
          </div>
        )}

        {game.status === 'active' && board && !board.winner && (
          <div className="glass-card p-4 space-y-3">
            <p className="label-caps">End game</p>
            <p className="text-faint text-xs">
              Return everyone to the lobby for a fresh board, or close the session so players see final results.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={playAgain}
                disabled={playingAgain || ending}
                className="btn-primary flex-1"
              >
                {playingAgain ? 'Returning…' : 'Return to lobby'}
              </button>
              <button
                type="button"
                onClick={endSession}
                disabled={playingAgain || ending}
                className="btn-secondary flex-1"
              >
                {ending ? 'Closing…' : 'Close session'}
              </button>
            </div>
          </div>
        )}

        {board && game.status === 'finished' && board.winner && showAdminBoard && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">
            <div className="glass-card p-8 text-center space-y-2 border-amber-400/40">
              <p className="text-4xl">🏆</p>
              <p className="text-2xl font-black">{teamLabel(board.winner)} team wins!</p>
              {board.assassin_team && (
                <p className="text-muted text-sm">{teamLabel(board.assassin_team)} hit the assassin</p>
              )}
              <CodewordsBoardGrid board={board} showKey cellAttribution={cellAttribution} />
            </div>
            <aside className="space-y-4">
              <CodewordsScoreboard board={board} players={players} roles={roles} />
              <CodewordsGuessSummary guesses={guesses} players={players} />
              <CodewordsGuessLog guesses={guesses} players={players} roles={roles} compact />
            </aside>
          </div>
        )}

        {board && game.status === 'finished' && !board.winner && showAdminBoard && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">
            <div className="glass-card p-8 text-center space-y-2 border-amber-400/40">
              <p className="text-4xl">🛑</p>
              <p className="text-2xl font-black">Session ended</p>
              <p className="text-muted text-sm">The host closed this game before a winner was decided.</p>
              <CodewordsBoardGrid board={board} showKey cellAttribution={cellAttribution} />
            </div>
            <aside className="space-y-4">
              <CodewordsScoreboard board={board} players={players} roles={roles} />
              <CodewordsGuessSummary guesses={guesses} players={players} />
              <CodewordsGuessLog guesses={guesses} players={players} roles={roles} compact />
            </aside>
          </div>
        )}

        {board && game.status === 'finished' && hostPlayerView && hostMyRole && (
          <div className="glass-card p-5">
            <CodewordsActiveRound
              gameCode={gameCode}
              game={game}
              board={board}
              myPlayerId={hostPlayerId!}
              myPlayerName={hostPlayerName}
              myRole={hostMyRole}
              players={players}
              roles={roles}
              guesses={guesses}
              onBoardChange={setBoard}
              onReload={load}
              hideKey
              compactHeader
            />
          </div>
        )}

        {game.status === 'finished' && (
          <button type="button" onClick={playAgain} disabled={playingAgain} className="btn-secondary w-full">
            {playingAgain ? 'Resetting…' : 'Return to lobby'}
          </button>
        )}

        <button type="button" onClick={() => router.push('/')} className="btn-ghost w-full text-muted">
          Back home
        </button>
      </div>
    </div>
  )
}
