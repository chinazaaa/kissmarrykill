'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CodewordsBoardGrid, CodewordsTeamBadge } from '@/components/codewords/CodewordsBoardGrid'
import { GameTypeBadge } from '@/components/GameTypeBadge'
import { gameTypeConfig } from '@/lib/game-types'
import { countRevealedTeamCells, countTeamCells, roleLabel, teamLabel } from '@/lib/codewords'
import { supabase } from '@/lib/supabase'
import { getPlayerSession, setPlayerSession, clearPlayerSession } from '@/lib/utils'
import type { CodewordsBoard, CodewordsPlayerRole, CodewordsRole, CodewordsTeam, Game } from '@/types'
import { useToast } from '@/components/ui/Toast'

type Screen = 'loading' | 'join' | 'lobby' | 'active' | 'finished' | 'not_found'

export function CodewordsPlayerView({ gameCode }: { gameCode: string }) {
  const router = useRouter()
  const { success, error: toastError } = useToast()
  const [screen, setScreen] = useState<Screen>('loading')
  const [game, setGame] = useState<Game | null>(null)
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [myPlayerName, setMyPlayerName] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joining, setJoining] = useState(false)
  const [myRole, setMyRole] = useState<CodewordsPlayerRole | null>(null)
  const [board, setBoard] = useState<CodewordsBoard | null>(null)
  const [pickingTeam, setPickingTeam] = useState<CodewordsTeam | null>(null)
  const [pickingRole, setPickingRole] = useState<CodewordsRole | null>(null)
  const [savingRole, setSavingRole] = useState(false)
  const [clueWord, setClueWord] = useState('')
  const [clueNumber, setClueNumber] = useState(1)
  const [submittingClue, setSubmittingClue] = useState(false)
  const [guessing, setGuessing] = useState(false)
  const [endingTurn, setEndingTurn] = useState(false)

  const syncScreen = useCallback((gameData: Game, playerId: string | null) => {
    if (gameData.status === 'waiting') {
      setScreen(playerId ? 'lobby' : 'join')
      return
    }
    if (gameData.status === 'active') {
      setScreen(playerId ? 'active' : 'join')
      return
    }
    setScreen(playerId ? 'finished' : 'join')
  }, [])

  const load = useCallback(async () => {
    const [{ data: gameData }, { data: boardData }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameCode).maybeSingle(),
      supabase.from('codewords_boards').select('*').eq('game_id', gameCode).maybeSingle(),
    ])

    if (!gameData) {
      setScreen('not_found')
      return
    }

    setGame(gameData)
    setBoard(boardData as CodewordsBoard | null)

    const session = getPlayerSession(gameCode)
    let playerId = session?.playerId ?? null
    if (session) {
      const { data: plr } = await supabase.from('players').select('id, name').eq('id', session.playerId).maybeSingle()
      if (!plr) {
        clearPlayerSession(gameCode)
        playerId = null
        setMyPlayerId(null)
        setMyPlayerName('')
        setMyRole(null)
      } else {
        setMyPlayerId(session.playerId)
        setMyPlayerName(session.playerName)
        const { data: role } = await supabase
          .from('codewords_player_roles')
          .select('*')
          .eq('game_id', gameCode)
          .eq('player_id', session.playerId)
          .maybeSingle()
        setMyRole(role as CodewordsPlayerRole | null)
        if (role) {
          setPickingTeam(role.team)
          setPickingRole(role.role)
        }
      }
    }
    syncScreen(gameData, playerId)
  }, [gameCode, syncScreen])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel(`codewords-player-${gameCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameCode}` }, (p) => {
        const next = p.new as Game
        setGame(next)
        syncScreen(next, myPlayerId)
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'codewords_boards', filter: `game_id=eq.${gameCode}` },
        (p) => setBoard(p.new as CodewordsBoard)
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameCode, myPlayerId, syncScreen])

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

  const saveRole = async () => {
    if (!myPlayerId || !pickingTeam || !pickingRole) return
    setSavingRole(true)
    try {
      const res = await fetch('/api/codewords/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: gameCode, playerId: myPlayerId, team: pickingTeam, role: pickingRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save role')
      setMyRole(data.role)
      success(`You're ${teamLabel(pickingTeam)} ${roleLabel(pickingRole)}`)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save role')
    } finally {
      setSavingRole(false)
    }
  }

  const submitClue = async () => {
    if (!myPlayerId || !clueWord.trim()) return
    setSubmittingClue(true)
    try {
      const res = await fetch('/api/codewords/clue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: gameCode,
          playerId: myPlayerId,
          clueWord: clueWord.trim(),
          clueNumber,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to give clue')
      setBoard(data.board)
      setClueWord('')
      success('Clue sent!')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to give clue')
    } finally {
      setSubmittingClue(false)
    }
  }

  const guessCell = async (index: number) => {
    if (!myPlayerId || guessing) return
    setGuessing(true)
    try {
      const res = await fetch('/api/codewords/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: gameCode, playerId: myPlayerId, cellIndex: index }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to guess')
      setBoard(data.board)
      if (data.board.winner) await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to guess')
    } finally {
      setGuessing(false)
    }
  }

  const endTurn = async () => {
    if (!myPlayerId || endingTurn) return
    setEndingTurn(true)
    try {
      const res = await fetch('/api/codewords/end-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: gameCode, playerId: myPlayerId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to end turn')
      setBoard(data.board)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to end turn')
    } finally {
      setEndingTurn(false)
    }
  }

  const cfg = gameTypeConfig('codewords')
  const isSpymaster = myRole?.role === 'spymaster'
  const isOperative = myRole?.role === 'operative'
  const myTeam = myRole?.team
  const isMyTurn = board && myTeam && board.current_turn === myTeam && !board.winner
  const canGiveClue = isMyTurn && isSpymaster && !board?.current_clue_word
  const canGuess = isMyTurn && isOperative && !!board?.current_clue_word

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  if (screen === 'not_found') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-xl font-bold">Game not found</p>
        <button type="button" onClick={() => router.push('/')} className="btn-secondary">
          Go home
        </button>
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
            <GameTypeBadge gameType="codewords" />
          </div>
          <div>
            <label className="label-caps block mb-2">Your name</label>
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinGame()}
              placeholder="Enter your name"
              className="input-field w-full"
              maxLength={40}
            />
          </div>
          <p className="text-faint text-xs">You&apos;ll pick a team and role in the lobby before the host starts.</p>
          <button type="button" onClick={joinGame} disabled={!joinName.trim() || joining} className="btn-primary w-full">
            {joining ? 'Joining…' : 'Join game'}
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'lobby') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="glass-card p-6 w-full max-w-md space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black">Pick your team & role</h2>
            <p className="text-muted text-sm">Playing as {myPlayerName}</p>
          </div>

          <div className="space-y-2">
            <p className="label-caps">Team</p>
            <div className="grid grid-cols-2 gap-2">
              {(['red', 'blue'] as const).map((team) => (
                <button
                  key={team}
                  type="button"
                  onClick={() => setPickingTeam(team)}
                  className={[
                    'rounded-xl border-2 px-3 py-3 font-bold text-sm transition-all',
                    pickingTeam === team
                      ? team === 'red'
                        ? 'border-red-500 bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-100'
                        : 'border-blue-500 bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-100'
                      : 'border-[var(--border-strong)] bg-[var(--surface-inset-bg)] text-muted',
                  ].join(' ')}
                >
                  {team === 'red' ? '🔴 Red' : '🔵 Blue'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="label-caps">Role</p>
            <div className="grid grid-cols-2 gap-2">
              {(['spymaster', 'operative'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setPickingRole(role)}
                  className={[
                    'rounded-xl border-2 px-3 py-3 font-bold text-sm transition-all',
                    pickingRole === role
                      ? 'border-[var(--foreground)]/30 bg-[var(--surface-inset-bg)] text-[var(--foreground)]'
                      : 'border-[var(--border-strong)] bg-[var(--surface-inset-bg)] text-muted',
                  ].join(' ')}
                >
                  {role === 'spymaster' ? '🕵️ Spymaster' : '🎯 Operative'}
                </button>
              ))}
            </div>
            <p className="text-faint text-xs leading-relaxed">
              <strong>Spymaster</strong> sees the secret key and gives one-word clues. <strong>Operative</strong> guesses
              words on the grid. Each team needs 1 spymaster and at least 1 operative.
            </p>
          </div>

          {myRole && (
            <p className="text-center text-sm text-muted">
              Saved: <CodewordsTeamBadge team={myRole.team} /> {roleLabel(myRole.role)}
            </p>
          )}

          <button
            type="button"
            onClick={saveRole}
            disabled={!pickingTeam || !pickingRole || savingRole}
            className="btn-primary w-full"
          >
            {savingRole ? 'Saving…' : 'Confirm team & role'}
          </button>

          <p className="text-center text-faint text-xs">Waiting for the host to start…</p>
        </div>
      </div>
    )
  }

  if (screen === 'finished' && board) {
    const iWon = board.winner && myTeam === board.winner
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl space-y-4">
          <div className="glass-card p-8 text-center space-y-2">
            <p className="text-4xl">🏆</p>
            {iWon ? (
              <>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-200">Your team wins!</p>
                <p className="text-muted text-sm">Great spycraft, {myPlayerName}.</p>
              </>
            ) : (
              <>
                <p className="text-xl font-black">{board.winner ? teamLabel(board.winner) : ''} team wins</p>
                <p className="text-muted text-sm">The host can start a new round.</p>
              </>
            )}
          </div>
          <div className="glass-card p-4">
            <CodewordsBoardGrid board={board} showKey={isSpymaster} />
          </div>
        </div>
      </div>
    )
  }

  if (!board || !myRole) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-muted">Setting up the board…</p>
      </div>
    )
  }

  const redLeft =
    countTeamCells(board.key, 'red') - countRevealedTeamCells(board.key, board.revealed_indices, 'red')
  const blueLeft =
    countTeamCells(board.key, 'blue') - countRevealedTeamCells(board.key, board.revealed_indices, 'blue')

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="text-center space-y-1">
          <div className="text-3xl">{cfg.headerEmoji}</div>
          <h1 className="text-xl font-black gradient-title">{game?.title}</h1>
          <p className="text-muted text-sm">
            {myPlayerName} · <CodewordsTeamBadge team={myRole.team} /> {roleLabel(myRole.role)}
          </p>
        </div>

        <div className="flex justify-center gap-4 text-sm font-bold">
          <span className="text-red-700 dark:text-red-200">🔴 {redLeft} left</span>
          <span className="text-blue-700 dark:text-blue-200">🔵 {blueLeft} left</span>
        </div>

        {isMyTurn ? (
          <div className="glass-card p-4 text-center text-sm font-medium border-blue-400/30">
            <CodewordsTeamBadge team={board.current_turn} /> team&apos;s turn —{' '}
            {isSpymaster ? 'give a clue' : 'guess words'}
          </div>
        ) : (
          <div className="glass-card p-4 text-center text-sm text-muted">
            Waiting for <CodewordsTeamBadge team={board.current_turn} /> team…
          </div>
        )}

        {board.current_clue_word && (
          <div className="glass-card p-4 text-center">
            <p className="text-faint text-xs uppercase tracking-wider">Current clue</p>
            <p className="text-2xl font-black">
              {board.current_clue_word}{' '}
              <span className="text-muted text-lg">{board.current_clue_number}</span>
            </p>
            {canGuess && board.guesses_remaining != null && (
              <p className="text-faint text-xs mt-1">{board.guesses_remaining} guess(es) left</p>
            )}
          </div>
        )}

        {canGiveClue && (
          <div className="glass-card p-4 space-y-3">
            <p className="label-caps">Give a clue</p>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={clueWord}
                onChange={(e) => setClueWord(e.target.value)}
                placeholder="One word"
                className="input-field flex-1 min-w-[8rem]"
                maxLength={40}
              />
              <input
                type="number"
                min={0}
                max={9}
                value={clueNumber}
                onChange={(e) => setClueNumber(Number(e.target.value) || 0)}
                className="input-field w-20"
              />
            </div>
            <button
              type="button"
              onClick={submitClue}
              disabled={!clueWord.trim() || submittingClue}
              className="btn-primary w-full"
            >
              {submittingClue ? 'Sending…' : 'Send clue'}
            </button>
          </div>
        )}

        <div className="glass-card p-4">
          <CodewordsBoardGrid
            board={board}
            showKey={isSpymaster}
            guessable={!!canGuess}
            onGuess={guessCell}
            disabled={guessing}
          />
        </div>

        {canGuess && (
          <button type="button" onClick={endTurn} disabled={endingTurn} className="btn-secondary w-full">
            {endingTurn ? 'Ending…' : 'End turn early'}
          </button>
        )}
      </div>
    </div>
  )
}
