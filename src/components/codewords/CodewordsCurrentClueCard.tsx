'use client'

import type { CodewordsBoard } from '@/types'

export function CodewordsCurrentClueCard({
  board,
  showGuessesRemaining = false,
}: {
  board: Pick<CodewordsBoard, 'current_clue_word' | 'current_clue_number' | 'guesses_remaining'>
  showGuessesRemaining?: boolean
}) {
  if (!board.current_clue_word) return null

  return (
    <div className="glass-card p-4 text-center">
      <p className="text-faint text-xs uppercase tracking-wider">Current clue</p>
      <p className="text-2xl font-black">
        {board.current_clue_word} <span className="text-muted text-lg">{board.current_clue_number}</span>
      </p>
      {showGuessesRemaining && board.guesses_remaining != null && (
        <p className="text-faint text-xs mt-1">{board.guesses_remaining} guess(es) left</p>
      )}
    </div>
  )
}
