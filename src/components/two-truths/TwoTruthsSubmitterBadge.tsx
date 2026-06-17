'use client'

import type { Player } from '@/types'
import { playerDisplayName } from '@/lib/two-truths'

export function TwoTruthsSubmitterBadge({
  submitterId,
  players,
  highlightPlayerId,
  size = 'md',
}: {
  submitterId: string | null | undefined
  players: Player[]
  highlightPlayerId?: string | null
  size?: 'sm' | 'md'
}) {
  const name = playerDisplayName(submitterId, players)
  const isYou = highlightPlayerId && submitterId === highlightPlayerId
  const initial = name.charAt(0).toUpperCase()

  return (
    <div
      className={[
        'inline-flex items-center gap-2.5 rounded-full border border-[var(--border-strong)] bg-[var(--surface-inset-bg)]',
        size === 'sm' ? 'px-3 py-1.5' : 'px-4 py-2',
      ].join(' ')}
    >
      <span
        className={[
          'inline-flex items-center justify-center rounded-full bg-violet-500/20 text-violet-800 dark:text-violet-100 font-black shrink-0',
          size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm',
        ].join(' ')}
        aria-hidden
      >
        {initial}
      </span>
      <div className="text-left min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-faint leading-none">Submitted by</p>
        <p className={['font-bold truncate', size === 'sm' ? 'text-sm' : 'text-base'].join(' ')}>
          {name}
          {isYou ? ' (you)' : ''}
        </p>
      </div>
    </div>
  )
}
