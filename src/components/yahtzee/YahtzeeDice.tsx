'use client'

import { useEffect, useState, useRef } from 'react'

const DIE_DOTS: Record<number, number[][]> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [0, 1],
    [0, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
}

interface DieFaceProps {
  value: number
  held?: boolean
  onClick?: () => void
  interactive?: boolean
  isRolling?: boolean
}

function DieFace({ value, held, onClick, interactive, isRolling }: DieFaceProps) {
  const dots = DIE_DOTS[value] ?? DIE_DOTS[1]!

  if (!interactive) {
    return (
      <div
        className={[
          'yahtzee-die relative h-12 w-12 sm:h-14 sm:w-14 rounded-2xl border-2 select-none',
          held ? 'yahtzee-die-held border-[var(--marry)]' : 'border-[color-mix(in_srgb,var(--foreground)_12%,transparent)]',
          isRolling && !held ? 'animate-dice-roll' : '',
        ].join(' ')}
      >
        <DiePips dots={dots} />
        {held && <HeldBadge />}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Die showing ${value}${held ? ', kept' : ''}`}
      aria-pressed={held}
      className={[
        'yahtzee-die relative h-12 w-12 sm:h-14 sm:w-14 rounded-2xl border-2 transition-all duration-150 select-none outline-none touch-manipulation',
        held
          ? 'yahtzee-die-held border-[var(--marry)] scale-105 -translate-y-1'
          : 'border-[color-mix(in_srgb,var(--foreground)_12%,transparent)]',
        'cursor-pointer hover:border-[var(--marry)]/70 hover:-translate-y-0.5 active:scale-95 active:translate-y-0',
        isRolling && !held ? 'animate-dice-roll pointer-events-none' : '',
      ].join(' ')}
    >
      <DiePips dots={dots} />
      {held && <HeldBadge />}
    </button>
  )
}

function DiePips({ dots }: { dots: number[][] }) {
  return (
    <div className="pointer-events-none grid h-full w-full grid-cols-3 grid-rows-3 p-2">
      {dots.map(([row, col], i) => (
        <span
          key={i}
          className="yahtzee-die-pip rounded-full"
          style={{
            gridRow: row + 1,
            gridColumn: col + 1,
            width: 8,
            height: 8,
            placeSelf: 'center',
          }}
        />
      ))}
    </div>
  )
}

function HeldBadge() {
  return (
    <span className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--marry)] px-1.5 py-0.5 text-[8px] font-black tracking-wider text-white whitespace-nowrap shadow-sm">
      KEEP
    </span>
  )
}

export function YahtzeeDiceRow({
  dice,
  held,
  onToggleHold,
  interactive,
}: {
  dice: number[]
  held: boolean[]
  onToggleHold?: (index: number) => void
  interactive?: boolean
}) {
  const [isRolling, setIsRolling] = useState(false)
  const [displayDice, setDisplayDice] = useState<number[]>(dice)
  const prevDiceRef = useRef<number[]>(dice)
  // Use a ref so the animation interval always reads the latest held state
  // without `held` being in the effect's dep array (which would cancel the
  // animation mid-flight every time the player taps a die to hold it).
  const heldRef = useRef<boolean[]>(held)
  heldRef.current = held

  useEffect(() => {
    const changed = dice.some((val, idx) => val !== prevDiceRef.current[idx])
    if (changed) {
      setIsRolling(true)
      prevDiceRef.current = dice

      let ticks = 0
      const interval = setInterval(() => {
        setDisplayDice(
          dice.map((d, i) => {
            const wasHeld = heldRef.current[i]
            return wasHeld ? d : Math.floor(Math.random() * 6) + 1
          })
        )
        ticks++
        if (ticks >= 5) {
          clearInterval(interval)
          setDisplayDice(dice)
          setIsRolling(false)
        }
      }, 60)

      return () => {
        clearInterval(interval)
        setIsRolling(false) // always clear rolling state when effect re-runs
      }
    }
    setDisplayDice(dice)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dice]) // intentionally omit `held` — handled via heldRef

  return (
    <div className="flex items-end justify-center gap-2 sm:gap-2.5">
      {displayDice.map((value, i) => (
        <DieFace
          key={i}
          value={value}
          held={held[i]}
          isRolling={isRolling}
          interactive={interactive && !!onToggleHold}
          onClick={interactive && onToggleHold ? () => onToggleHold(i) : undefined}
        />
      ))}
    </div>
  )
}
