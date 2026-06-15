'use client'

import { useEffect, useRef } from 'react'
import { effectiveTurnPhase, roleLabel, teamLabel } from '@/lib/codewords'
import {
  playGameFinishedSound,
  playRoundEndSound,
  playRoundStartSound,
  playTickTockSound,
  TIMER_TICK_THRESHOLD,
} from '@/lib/sounds'
import { useToast } from '@/components/ui/Toast'
import type { CodewordsBoard, CodewordsPlayerRole, Game } from '@/types'

export function useCodewordsNotifications({
  game,
  board,
  myRole,
  enabled = true,
}: {
  game: Game | null
  board: CodewordsBoard | null
  myRole: CodewordsPlayerRole | null | undefined
  enabled?: boolean
}) {
  const { info, success } = useToast()
  const readyRef = useRef(false)
  const prevBoardRef = useRef<CodewordsBoard | null>(null)
  const prevGameStatusRef = useRef<Game['status'] | null>(null)
  const prevRoleKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !game) return

    const prevBoard = prevBoardRef.current
    const prevStatus = prevGameStatusRef.current
    const prevRoleKey = prevRoleKeyRef.current
    const roleKey = myRole ? `${myRole.team}:${myRole.role}` : null

    if (!readyRef.current) {
      readyRef.current = true
      prevBoardRef.current = board
      prevGameStatusRef.current = game.status
      prevRoleKeyRef.current = roleKey
      return
    }

    if (prevStatus === 'waiting' && game.status === 'active') {
      info('Game started!')
      playRoundStartSound()
    }

    if (prevStatus === 'active' && game.status === 'waiting') {
      info('Returned to lobby')
    }

    if (prevStatus === 'active' && game.status === 'finished' && !board?.winner) {
      info('Session ended')
    }

    if (!prevRoleKey && roleKey && myRole) {
      info(`You're ${teamLabel(myRole.team)} ${roleLabel(myRole.role)}`)
    }

    if (prevBoard && board) {
      if (!prevBoard.winner && board.winner) {
        if (myRole?.team === board.winner) {
          success('Your team wins!')
          playGameFinishedSound()
        } else {
          info(`${teamLabel(board.winner)} team wins`)
          playRoundEndSound()
        }
        if (board.assassin_team && myRole?.team === board.assassin_team) {
          info('Your team hit the assassin')
        }
      }

      const turnChanged = prevBoard.current_turn !== board.current_turn
      const clueAppeared = !prevBoard.current_clue_word && !!board.current_clue_word
      const clueCleared = !!prevBoard.current_clue_word && !board.current_clue_word

      if (clueAppeared && board.current_turn === myRole?.team && myRole?.role === 'operative') {
        info(`Clue: ${board.current_clue_word} ${board.current_clue_number ?? ''} — tap words to guess`)
        playRoundStartSound()
      }

      if (turnChanged) {
        if (board.current_turn === myRole?.team) {
          const phase = effectiveTurnPhase(board)
          if (myRole?.role === 'spymaster' && phase === 'clue' && !board.current_clue_word) {
            info('Your turn — give a one-word clue')
            playRoundStartSound()
          } else if (myRole?.role === 'operative' && phase === 'clue') {
            info("Your team's turn — waiting for spymaster")
          }
        } else if (myRole) {
          info(`${teamLabel(board.current_turn)} team's turn`)
        }
      }

      if (
        clueCleared &&
        turnChanged &&
        prevBoard.current_turn === myRole?.team &&
        board.current_turn !== myRole?.team &&
        myRole?.role === 'operative'
      ) {
        info('Turn over')
        playRoundEndSound()
      }

      const prevRevealed = prevBoard.revealed_indices.length
      const newRevealed = board.revealed_indices.length
      if (newRevealed > prevRevealed && board.current_turn === myRole?.team && myRole?.role === 'spymaster') {
        const lastIndex = board.revealed_indices[board.revealed_indices.length - 1]
        const word = board.words[lastIndex]
        if (word) info(`Operatives revealed: ${word}`)
      }
    }

    prevBoardRef.current = board
    prevGameStatusRef.current = game.status
    prevRoleKeyRef.current = roleKey
  }, [board, enabled, game, info, myRole, success])
}

export function useCodewordsTimerAlerts(secondsLeft: number, enabled: boolean) {
  const lastTickRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled || secondsLeft <= 0 || secondsLeft > TIMER_TICK_THRESHOLD) {
      lastTickRef.current = null
      return
    }
    if (lastTickRef.current === secondsLeft) return
    lastTickRef.current = secondsLeft
    playTickTockSound(secondsLeft)
  }, [enabled, secondsLeft])
}
