'use client'

import { LudoDice } from '@/components/ludo/LudoChrome'

export function LudoBoardCenter({
  diceValue,
  rolling,
  showRoll,
  onRoll,
  acting,
  consecutiveSixes,
  phase,
  lastDice,
}: {
  diceValue: number | null
  rolling?: boolean
  showRoll?: boolean
  onRoll?: () => void
  acting?: boolean
  consecutiveSixes?: number
  phase?: 'roll' | 'move' | 'finished'
  lastDice?: number | null
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 sm:gap-1 px-0.5 text-center">
      <LudoDice value={diceValue} rolling={rolling} compact />

      {phase === 'move' && lastDice != null && (
        <p className="rounded bg-white/95 px-1 py-px text-[8px] sm:text-[10px] font-bold text-slate-900 tabular-nums leading-none shadow-sm">
          Rolled {lastDice}
        </p>
      )}

      {consecutiveSixes != null && consecutiveSixes > 0 && (
        <p className="rounded bg-white/95 px-1 py-px text-[7px] sm:text-[9px] font-bold text-slate-900 tabular-nums leading-none shadow-sm">
          6s: {consecutiveSixes}/3
        </p>
      )}

      {showRoll && onRoll && (
        <button
          type="button"
          onClick={onRoll}
          disabled={acting || rolling}
          className="mt-0.5 rounded-md bg-amber-400 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-slate-900 shadow-sm transition-colors hover:bg-amber-300 disabled:opacity-40 sm:px-2.5 sm:py-1"
        >
          {acting || rolling ? '…' : '🎲 Roll'}
        </button>
      )}
    </div>
  )
}
