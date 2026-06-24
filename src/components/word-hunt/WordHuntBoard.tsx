'use client'

import { wordFromPath } from '@/lib/word-hunt'
import { WordHuntGrid } from '@/components/word-hunt/WordHuntGrid'

interface WordHuntBoardProps {
  grid: string[][]
  selectedPath: number[]
  onPathChange: (path: number[]) => void
  foundWords?: string[]
  disabled?: boolean
  compact?: boolean
}

export function WordHuntBoard({
  grid,
  selectedPath,
  onPathChange,
  foundWords = [],
  disabled = false,
  compact = false,
}: WordHuntBoardProps) {
  const currentWord = wordFromPath(grid, selectedPath)

  return (
    <div className="space-y-3">
      <WordHuntGrid
        grid={grid}
        selectedPath={selectedPath}
        onPathChange={onPathChange}
        disabled={disabled}
        variant="host"
      />

      {!compact && (
        <>
          <div className="text-center min-h-[2rem]">
            <p className="text-lg font-black tracking-wide uppercase text-[var(--foreground)]">
              {currentWord || <span className="text-muted font-medium normal-case text-sm">Tap adjacent letters</span>}
            </p>
          </div>

          {foundWords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {foundWords.map((w) => (
                <span
                  key={w}
                  className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--chip-active-bg)] text-[var(--chip-active-text)] border border-[var(--chip-active-border)]"
                >
                  {w}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
