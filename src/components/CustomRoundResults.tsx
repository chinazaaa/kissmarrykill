'use client'
import type { CustomSlot } from '@/types'
import type { CustomTally } from '@/lib/custom-game'
import { Avatar } from '@/components/Avatar'

interface CustomRoundResultsProps {
  tally: CustomTally
  slots: CustomSlot[]
  myAssignment?: Record<string, string> | null
}

export function CustomRoundResults({ tally, slots, myAssignment }: CustomRoundResultsProps) {
  const gridCols: Record<number, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
  }

  return (
    <div className="space-y-4">
      {/* Winners summary */}
      <div className="glass-card border border-theme-strong p-4 space-y-3">
        <p className="text-muted text-xs uppercase tracking-wider text-center">
          Round results · {tally.voterCount} {tally.voterCount === 1 ? 'vote' : 'votes'}
        </p>
        <div className={`grid gap-2 ${gridCols[slots.length] ?? 'grid-cols-3'}`}>
          {slots.map((slot) => {
            const winner = tally.slotWinners[slot.key]
            return (
              <div key={slot.key} className="surface-inset rounded-xl px-2 py-3 text-center">
                <p className="text-lg">{slot.emoji}</p>
                <p className="text-faint text-[10px] uppercase tracking-wider mt-0.5">Most {slot.label}</p>
                <p className="text-body font-semibold text-sm mt-1 leading-tight truncate">
                  {winner?.name ?? '—'}
                </p>
                {winner && <p className="text-faint text-[10px] mt-0.5">{winner.count} votes</p>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-participant breakdown */}
      <div className="space-y-3">
        {tally.rows.map((row) => {
          const maxCount = Math.max(1, ...Object.values(row.counts))
          const mySlot = myAssignment?.[row.participantId]
          const mySlotMeta = mySlot ? slots.find((s) => s.key === mySlot) : null

          return (
            <div key={row.participantId} className="glass-card rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <Avatar name={row.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-body font-bold truncate">{row.name}</p>
                  {mySlotMeta && (
                    <p className="text-xs mt-0.5" style={{ color: mySlotMeta.color }}>
                      You: {mySlotMeta.emoji} {mySlotMeta.label}
                    </p>
                  )}
                </div>
              </div>
              <div className={`grid gap-2 ${gridCols[slots.length] ?? 'grid-cols-3'}`}>
                {slots.map((slot) => {
                  const count = row.counts[slot.key] ?? 0
                  const pct = Math.min((count / maxCount) * 100, 100)
                  const isWinner = tally.slotWinners[slot.key]?.name === row.name
                  return (
                    <div key={slot.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span style={{ color: slot.color }}>{slot.emoji}</span>
                        <span className="text-body font-bold">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isWinner ? slot.color : `${slot.color}80`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
