'use client'

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

function DieFace({ value, held, onClick, interactive }: { value: number; held?: boolean; onClick?: () => void; interactive?: boolean }) {
  const dots = DIE_DOTS[value] ?? DIE_DOTS[1]!
  const Tag = interactive ? 'button' : 'div'

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={[
        'relative h-14 w-14 rounded-xl border-2 bg-white shadow-md transition-all',
        held ? 'border-[var(--marry)] ring-2 ring-[var(--marry)]/40 scale-105' : 'border-neutral-300',
        interactive ? 'cursor-pointer hover:border-[var(--marry)]/60 active:scale-95' : '',
      ].join(' ')}
    >
      <div className="grid h-full w-full grid-cols-3 grid-rows-3 p-1.5">
        {dots.map(([row, col], i) => (
          <span
            key={i}
            className="rounded-full bg-neutral-900"
            style={{ gridRow: row + 1, gridColumn: col + 1, width: 8, height: 8, placeSelf: 'center' }}
          />
        ))}
      </div>
      {held && (
        <span className="absolute -top-1.5 -right-1.5 rounded-full bg-[var(--marry)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--background)]">
          HOLD
        </span>
      )}
    </Tag>
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
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {dice.map((value, i) => (
        <DieFace
          key={i}
          value={value}
          held={held[i]}
          interactive={interactive && !!onToggleHold}
          onClick={interactive && onToggleHold ? () => onToggleHold(i) : undefined}
        />
      ))}
    </div>
  )
}
