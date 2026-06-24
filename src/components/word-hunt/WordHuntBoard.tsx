'use client'

import { useCallback, useRef } from 'react'
import { rowColToIndex } from '@/lib/word-hunt'

interface WordHuntBoardProps {
  grid: string[][]
  selectedPath: number[]
  onPathChange: (path: number[]) => void
  foundWords?: string[]
  disabled?: boolean
}

export function WordHuntBoard({
  grid,
  selectedPath,
  onPathChange,
  foundWords = [],
  disabled = false,
}: WordHuntBoardProps) {
  const isDragging = useRef(false)

  const handleCell = useCallback(
    (index: number) => {
      if (disabled) return

      const current = selectedPath
      const existingIdx = current.indexOf(index)

      if (existingIdx >= 0) {
        if (existingIdx === current.length - 1) {
          onPathChange(current.slice(0, -1))
        }
        return
      }

      if (current.length === 0) {
        onPathChange([index])
        return
      }

      const last = current[current.length - 1]
      const [lr, lc] = [Math.floor(last / 4), last % 4]
      const [r, c] = [Math.floor(index / 4), index % 4]
      if (Math.abs(lr - r) <= 1 && Math.abs(lc - c) <= 1) {
        onPathChange([...current, index])
      }
    },
    [disabled, onPathChange, selectedPath]
  )

  const currentWord = selectedPath
    .map((i) => {
      const [row, col] = [Math.floor(i / 4), i % 4]
      return grid[row]?.[col] ?? ''
    })
    .join('')

  return (
    <div className="space-y-3">
      <div
        className="rounded-2xl p-3 border-2 border-emerald-400/70 bg-emerald-950/40 shadow-[0_0_24px_rgba(52,211,153,0.15)]"
        onPointerUp={() => {
          isDragging.current = false
        }}
        onPointerLeave={() => {
          isDragging.current = false
        }}
      >
        <div className="grid grid-cols-4 gap-2">
          {grid.map((row, r) =>
            row.map((letter, c) => {
              const index = rowColToIndex(r, c)
              const inPath = selectedPath.includes(index)
              const pathOrder = selectedPath.indexOf(index)
              return (
                <button
                  key={index}
                  type="button"
                  disabled={disabled}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    isDragging.current = true
                    handleCell(index)
                  }}
                  onPointerEnter={() => {
                    if (isDragging.current) handleCell(index)
                  }}
                  className={`aspect-square rounded-lg font-black text-xl sm:text-2xl flex items-center justify-center select-none touch-none transition-all ${
                    inPath
                      ? 'bg-amber-200 text-amber-950 ring-2 ring-amber-400 scale-[1.03]'
                      : 'bg-[#e8d5b5] text-stone-900 shadow-inner hover:bg-[#f0e0c8]'
                  } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{
                    backgroundImage: inPath
                      ? undefined
                      : 'linear-gradient(145deg, rgba(255,255,255,0.35) 0%, transparent 50%)',
                  }}
                >
                  <span className="relative">
                    {letter}
                    {inPath && pathOrder >= 0 && (
                      <span className="absolute -top-2 -right-3 text-[9px] font-bold text-amber-700">
                        {pathOrder + 1}
                      </span>
                    )}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>

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
              className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
            >
              {w}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
