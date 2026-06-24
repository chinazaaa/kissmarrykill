'use client'

import { wordFromPath, WORD_HUNT_MIN_WORD_LENGTH } from '@/lib/word-hunt'
import { WordHuntGrid } from '@/components/word-hunt/WordHuntGrid'

type Props = {
  grid: string[][]
  selectedPath: number[]
  onPathChange: (path: number[]) => void
  foundWords: string[]
  myPoints: number
  timeLabel: string
  timeUp: boolean
  secondsLeft: number
  onClear: () => void
  onSubmit: () => void
  disabled?: boolean
}

export function WordHuntPlaySurface({
  grid,
  selectedPath,
  onPathChange,
  foundWords,
  myPoints,
  timeLabel,
  timeUp,
  secondsLeft,
  onClear,
  onSubmit,
  disabled = false,
}: Props) {
  const currentWord = wordFromPath(grid, selectedPath)
  const canSubmit = !disabled && !timeUp && selectedPath.length >= WORD_HUNT_MIN_WORD_LENGTH
  const timerUrgent = !timeUp && secondsLeft <= 10

  return (
    <div className="glass-card-strong overflow-hidden border border-[color-mix(in_srgb,var(--primary)_18%,var(--border))] shadow-[var(--card-shadow-glow)]">
      <div className="grid grid-cols-2 gap-2 p-4 border-b border-[var(--border)]">
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--primary)_14%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_6%,transparent)] px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted">Score</p>
          <p className="text-xl font-black tabular-nums text-[var(--foreground)] leading-tight">{myPoints}</p>
        </div>
        <div
          className={[
            'rounded-2xl border px-3 py-2.5 text-right',
            timerUrgent || timeUp
              ? 'border-[color-mix(in_srgb,var(--marry)_35%,var(--border))] bg-[color-mix(in_srgb,var(--marry)_8%,var(--card))]'
              : 'border-[color-mix(in_srgb,var(--primary)_14%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]',
          ].join(' ')}
        >
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted">Time</p>
          <p
            className={[
              'text-xl font-black tabular-nums leading-tight',
              timeUp ? 'text-[var(--kill)]' : timerUrgent ? 'text-[var(--marry)]' : 'text-[var(--foreground)]',
            ].join(' ')}
          >
            {timeUp ? '0:00' : timeLabel}
          </p>
        </div>
      </div>

      <div className="px-4 pt-4 pb-3">
        <WordHuntGrid
          grid={grid}
          selectedPath={selectedPath}
          onPathChange={onPathChange}
          disabled={disabled}
          variant="play"
        />
      </div>

      <div className="px-4 space-y-3">
        <div
          className={[
            'min-h-[3.25rem] rounded-2xl border px-3 sm:px-4 flex items-center gap-3 transition-colors',
            currentWord
              ? 'border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_8%,var(--card))]'
              : 'border-[var(--border)] bg-[var(--surface-inset-bg)] justify-center',
          ].join(' ')}
        >
          {currentWord ? (
            <>
              <p className="flex-1 min-w-0 text-center text-2xl sm:text-3xl font-black tracking-[0.28em] uppercase gradient-title truncate">
                {currentWord}
              </p>
              <button
                type="button"
                onClick={onClear}
                disabled={timeUp || disabled}
                aria-label="Clear selection"
                className="shrink-0 h-11 min-w-[5.5rem] px-4 rounded-xl border-2 border-[color-mix(in_srgb,var(--foreground)_28%,var(--border))] bg-[var(--card)] text-sm font-black text-[var(--foreground)] shadow-[var(--card-shadow)] active:scale-[0.98] disabled:opacity-40"
              >
                Clear
              </button>
            </>
          ) : (
            <p className="text-sm text-muted font-medium">Drag through adjacent letters</p>
          )}
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="btn-primary w-full h-12 !py-0 text-sm font-black"
        >
          {timeUp ? "Time's up" : 'Submit word'}
        </button>

        <div className="pb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="label-caps text-[10px]">Words found</p>
            <p className="text-[10px] text-faint tabular-nums">{foundWords.length}</p>
          </div>
          {foundWords.length > 0 ? (
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[var(--card-strong)] to-transparent z-[1]" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--card-strong)] to-transparent z-[1]" />
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {foundWords.map((w) => (
                  <span
                    key={w}
                    className="shrink-0 px-3 py-1 rounded-full text-xs font-bold bg-[var(--chip-active-bg)] text-[var(--chip-active-text)] border border-[var(--chip-active-border)]"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-[11px] text-faint">3 letters = 100 · 4 = 400 · 5 = 800 pts</p>
          )}
        </div>
      </div>
    </div>
  )
}
