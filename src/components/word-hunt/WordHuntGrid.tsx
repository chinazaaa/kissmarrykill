'use client'

import { rowColToIndex } from '@/lib/word-hunt'
import { useWordHuntGridInteraction } from '@/hooks/useWordHuntGridInteraction'

type Props = {
  grid: string[][]
  selectedPath: number[]
  onPathChange: (path: number[]) => void
  disabled?: boolean
  variant?: 'play' | 'host'
}

export function WordHuntGrid({ grid, selectedPath, onPathChange, disabled = false, variant = 'play' }: Props) {
  const { gridRef, gridHandlers } = useWordHuntGridInteraction(selectedPath, onPathChange, disabled)

  const frameClass =
    variant === 'play'
      ? 'surface-inset rounded-2xl p-2.5 sm:p-3 ring-1 ring-[color-mix(in_srgb,var(--primary)_12%,transparent)]'
      : 'rounded-2xl p-3 border border-[color-mix(in_srgb,var(--primary)_18%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_5%,var(--card-strong))] shadow-[var(--card-shadow)]'

  const cellBase =
    variant === 'play'
      ? 'aspect-square rounded-xl font-black text-lg sm:text-2xl flex items-center justify-center select-none transition-[transform,box-shadow,background-color] duration-100'
      : 'aspect-square rounded-lg font-black text-xl sm:text-2xl flex items-center justify-center select-none transition-all duration-100'

  return (
    <div
      ref={gridRef}
      className={[frameClass, 'touch-none'].join(' ')}
      style={{ touchAction: 'none' }}
      {...gridHandlers}
    >
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {grid.map((row, r) =>
          row.map((letter, c) => {
            const index = rowColToIndex(r, c)
            const inPath = selectedPath.includes(index)
            const pathOrder = selectedPath.indexOf(index)
            return (
              <div
                key={index}
                data-word-hunt-cell={index}
                aria-disabled={disabled}
                className={[
                  cellBase,
                  inPath
                    ? 'bg-[color-mix(in_srgb,var(--marry)_22%,var(--card-strong))] text-[var(--slot-marry-text)] shadow-[0_0_0_2px_var(--marry),0_8px_20px_-6px_color-mix(in_srgb,var(--marry)_45%,transparent)] scale-[1.04] z-[1]'
                    : variant === 'play'
                      ? 'bg-[var(--card-strong)] text-[var(--foreground)] border border-[var(--border-strong)] shadow-[var(--card-shadow)]'
                      : 'bg-[var(--card-strong)] text-[var(--foreground)] border border-[var(--border-strong)] shadow-[var(--card-shadow)]',
                  disabled ? 'opacity-50' : '',
                ].join(' ')}
                style={
                  inPath
                    ? undefined
                    : {
                        backgroundImage:
                          'linear-gradient(145deg, color-mix(in srgb, var(--primary) 4%, transparent) 0%, transparent 55%)',
                      }
                }
              >
                <span className="relative pointer-events-none">
                  {letter}
                  {inPath && pathOrder >= 0 && (
                    <span className="absolute -top-2.5 -right-3 text-[8px] font-black text-[var(--marry)]">
                      {pathOrder + 1}
                    </span>
                  )}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
