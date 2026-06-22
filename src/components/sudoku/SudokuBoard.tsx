'use client'

import { cellBlockIndex } from '@/lib/sudoku'

export type BlockStatus = 'idle' | 'claimed' | 'locked_out' | 'pending'

interface SudokuBoardProps {
  puzzle: number[][]         // 9×9, 0 = editable cell
  solution?: number[][]      // host-only: show solution
  userGrid?: number[][]      // player's current entries (9×9, 0 = empty)
  onCellChange?: (row: number, col: number, value: number) => void
  onSubmitBlock?: (blockIndex: number) => void
  blockStatuses?: BlockStatus[]  // per-block status for the local player (length 9)
  blockScorers?: string[][]      // per-block list of scorer names
  submitting?: number | null     // blockIndex currently being submitted
  readOnly?: boolean
}

const BLOCK_BORDER = 'border-[var(--foreground)]/50'
const INPUT_BASE =
  'w-full h-full flex items-center justify-center text-lg font-bold select-none cursor-default'

export function SudokuBoard({
  puzzle,
  solution,
  userGrid,
  onCellChange,
  onSubmitBlock,
  blockStatuses = Array(9).fill('idle'),
  blockScorers = Array(9).fill([]),
  submitting,
  readOnly = false,
}: SudokuBoardProps) {
  const grid = solution ?? puzzle

  return (
    <div className="w-full max-w-[min(440px,100%)] mx-auto space-y-3">
      {/* Grid */}
      <div
        className="grid border-2 border-[var(--foreground)]/60 rounded-lg overflow-hidden"
        style={{ gridTemplateColumns: 'repeat(9, 1fr)', aspectRatio: '1' }}
      >
        {Array.from({ length: 9 }, (_, row) =>
          Array.from({ length: 9 }, (_, col) => {
            const blockIdx = cellBlockIndex(row, col)
            const status = blockStatuses[blockIdx]
            const given = puzzle[row]?.[col] !== 0
            const displayValue = given
              ? puzzle[row][col]
              : solution
                ? solution[row][col]
                : userGrid?.[row]?.[col] || ''

            const borderRight = (col + 1) % 3 === 0 && col < 8 ? `border-r-2 ${BLOCK_BORDER}` : 'border-r border-[var(--border)]/40'
            const borderBottom = (row + 1) % 3 === 0 && row < 8 ? `border-b-2 ${BLOCK_BORDER}` : 'border-b border-[var(--border)]/40'

            const blockBg =
              status === 'claimed'
                ? 'bg-emerald-500/10'
                : status === 'locked_out'
                  ? 'bg-red-500/10'
                  : status === 'pending'
                    ? 'bg-amber-500/10'
                    : ''

            return (
              <div key={`${row}-${col}`} className={`relative ${borderRight} ${borderBottom} ${blockBg}`} style={{ aspectRatio: '1' }}>
                {given || solution || readOnly ? (
                  <div
                    className={`${INPUT_BASE} ${given ? 'text-[var(--foreground)]' : 'text-violet-500 dark:text-violet-400'}`}
                  >
                    {displayValue}
                  </div>
                ) : (
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={userGrid?.[row]?.[col] || ''}
                    disabled={status === 'claimed' || status === 'locked_out'}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^1-9]/g, '')
                      const num = raw ? parseInt(raw.slice(-1)) : 0
                      onCellChange?.(row, col, num)
                    }}
                    className={[
                      'w-full h-full text-center text-lg font-bold bg-transparent outline-none',
                      'focus:bg-violet-500/10',
                      given ? 'text-[var(--foreground)] cursor-default' : 'text-violet-600 dark:text-violet-400',
                      status === 'claimed' || status === 'locked_out' ? 'cursor-not-allowed opacity-60' : '',
                    ].join(' ')}
                  />
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Block submit buttons */}
      {!readOnly && onSubmitBlock && (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }, (_, blockIdx) => {
            const status = blockStatuses[blockIdx]
            const scorers = blockScorers[blockIdx] ?? []
            const isSubmitting = submitting === blockIdx

            if (status === 'claimed') {
              return (
                <div key={blockIdx} className="rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-2 py-1.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">✓ Solved</p>
                  {scorers.length > 0 && (
                    <p className="text-[9px] text-emerald-700 dark:text-emerald-300 truncate">{scorers[0]}</p>
                  )}
                </div>
              )
            }

            if (status === 'locked_out') {
              return (
                <div key={blockIdx} className="rounded-lg bg-red-500/10 border border-red-500/30 px-2 py-1.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-500">✗ Locked</p>
                </div>
              )
            }

            return (
              <button
                key={blockIdx}
                type="button"
                disabled={isSubmitting}
                onClick={() => onSubmitBlock(blockIdx)}
                className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-[11px] font-semibold text-[var(--muted)] hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? '…' : `Block ${blockIdx + 1}`}
              </button>
            )
          })}
        </div>
      )}

      {/* Read-only block status summary (host or solved view) */}
      {readOnly && (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }, (_, blockIdx) => {
            const scorers = blockScorers[blockIdx] ?? []
            return (
              <div key={blockIdx} className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-center min-h-[2.5rem]">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">Block {blockIdx + 1}</p>
                {scorers.length > 0 ? (
                  <p className="text-[9px] text-emerald-600 dark:text-emerald-400 truncate">{scorers[0]} +{scorers.length - 1 > 0 ? ` ${scorers.length - 1} more` : ''}</p>
                ) : (
                  <p className="text-[9px] text-[var(--faint)]">—</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
