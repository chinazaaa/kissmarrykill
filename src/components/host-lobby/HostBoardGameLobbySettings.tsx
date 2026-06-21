'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  boardGameToLobbyLimitType,
  formatBoardGameTurnTimer,
  turnTimerOptionsFor,
  type BoardGameLobbyType,
} from '@/lib/board-game-lobby-settings'
import {
  formatMonopolyGameDuration,
  MONOPOLY_GAME_DURATION_OPTIONS,
} from '@/lib/monopoly'
import { MONOPOLY_STARTING_CASH } from '@/lib/monopoly-board'
import {
  formatWhotGameDuration,
  WHOT_GAME_DURATION_OPTIONS,
} from '@/lib/whot'
import {
  lobbyMaxPlayersFromGame,
  playerCountOptions,
  type GamePlayerLimitsMap,
} from '@/lib/game-limits'
import { Toggle } from '@/components/ui/PageShell'
import { useToast } from '@/components/ui/Toast'
import type { Game } from '@/types'

type Props = {
  gameCode: string
  hostToken: string
  game: Game
  boardGameType: BoardGameLobbyType
  playerCount: number
  onGameUpdate: (game: Game) => void
}

export function HostBoardGameLobbySettings({
  gameCode,
  hostToken,
  game,
  boardGameType,
  playerCount,
  onGameUpdate,
}: Props) {
  const { error: toastError, success } = useToast()
  const [limits, setLimits] = useState<GamePlayerLimitsMap | null>(null)
  const [maxPlayers, setMaxPlayers] = useState(6)
  const [turnTimer, setTurnTimer] = useState(0)
  const [gameDuration, setGameDuration] = useState(0)
  const [whotPick3Enabled, setWhotPick3Enabled] = useState(true)
  const [whotCardsEnabled, setWhotCardsEnabled] = useState(true)
  const [whotNumberCallsEnabled, setWhotNumberCallsEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void fetch('/api/game-limits')
      .then((res) => res.json())
      .then((data: { limits?: GamePlayerLimitsMap }) => {
        if (data.limits) setLimits(data.limits)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!limits) return
    setMaxPlayers(lobbyMaxPlayersFromGame(boardGameToLobbyLimitType(boardGameType), game, limits))
    setTurnTimer(game.timer_seconds ?? 0)
    setGameDuration(game.game_duration_seconds ?? 0)
    if (boardGameType === 'whot') {
      setWhotPick3Enabled(game.whot_pick3_enabled !== false)
      setWhotCardsEnabled(game.whot_cards_enabled !== false)
      setWhotNumberCallsEnabled(game.whot_number_calls_enabled !== false)
    }
  }, [boardGameType, game, limits])

  const limitCfg = limits?.[boardGameToLobbyLimitType(boardGameType)]
  const minPlayers = limitCfg?.min ?? 2
  const maxCap = limitCfg?.max ?? 6

  const saveSettings = useCallback(async () => {
    if (maxPlayers < playerCount) {
      toastError(`Already have ${playerCount} players — pick at least ${playerCount} or remove someone`)
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        gameId: gameCode,
        hostToken,
        max_players: maxPlayers,
        timer_seconds: turnTimer,
      }
      if (boardGameType === 'monopoly' || boardGameType === 'whot') {
        body.game_duration_seconds = gameDuration
      }
      if (boardGameType === 'whot') {
        body.whot_pick3_enabled = whotPick3Enabled
        body.whot_cards_enabled = whotCardsEnabled
        body.whot_number_calls_enabled = whotNumberCallsEnabled
      }

      const res = await fetch(`/api/games/${gameCode}/lobby-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save settings')
      if (data.game) onGameUpdate(data.game)
      success('Settings saved')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }, [
    boardGameType,
    gameCode,
    gameDuration,
    hostToken,
    maxPlayers,
    onGameUpdate,
    playerCount,
    success,
    toastError,
    turnTimer,
    whotCardsEnabled,
    whotNumberCallsEnabled,
    whotPick3Enabled,
  ])

  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Max players</span>
        <select
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
          className="input-field w-full"
        >
          {playerCountOptions(minPlayers, maxCap).map((n) => (
            <option key={n} value={n}>
              {n} players
            </option>
          ))}
        </select>
        <span className="text-faint text-xs">
          {playerCount} joined · room holds up to {maxPlayers}
        </span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-semibold">Turn timer</span>
        <select
          value={turnTimer}
          onChange={(e) => setTurnTimer(Number(e.target.value))}
          className="input-field w-full"
        >
          {turnTimerOptionsFor(boardGameType).map((s) => (
            <option key={s} value={s}>
              {formatBoardGameTurnTimer(s)}
            </option>
          ))}
        </select>
      </label>

      {boardGameType === 'monopoly' && (
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Game length</span>
          <select
            value={gameDuration}
            onChange={(e) => setGameDuration(Number(e.target.value))}
            className="input-field w-full"
          >
            {MONOPOLY_GAME_DURATION_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {formatMonopolyGameDuration(s)}
              </option>
            ))}
          </select>
          <span className="text-faint text-xs leading-relaxed">
            £{MONOPOLY_STARTING_CASH.toLocaleString('en-GB')} starting cash. When time runs out, richest player wins.
          </span>
        </label>
      )}

      {boardGameType === 'whot' && (
        <>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Game length</span>
            <select
              value={gameDuration}
              onChange={(e) => setGameDuration(Number(e.target.value))}
              className="input-field w-full"
            >
              {WHOT_GAME_DURATION_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {formatWhotGameDuration(s)}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2">
            <p className="text-sm font-semibold">House rules</p>
            <Toggle
              label="Pick 3"
              description="Include 5 cards and the Pick 3 draw penalty"
              value={whotPick3Enabled}
              onChange={setWhotPick3Enabled}
            />
            <Toggle
              label="WHOT cards"
              description="Include WHOT wild cards in the deck"
              value={whotCardsEnabled}
              onChange={setWhotCardsEnabled}
            />
            <div className={whotCardsEnabled ? undefined : 'opacity-50 pointer-events-none'}>
              <Toggle
                label="Numbers on WHOT"
                description="Let players call a number when playing WHOT"
                value={whotNumberCallsEnabled}
                onChange={setWhotNumberCallsEnabled}
              />
            </div>
          </div>
        </>
      )}

      <button type="button" onClick={() => void saveSettings()} disabled={saving} className="btn-secondary w-full py-3">
        {saving ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  )
}
