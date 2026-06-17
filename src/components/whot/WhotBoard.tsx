'use client'

import type { WhotCard as WhotCardType, WhotShape } from '@/types'
import {
  WHOT_SHAPE_EMOJI,
  WHOT_SHAPE_LABELS,
  canPlayCard,
  specialCardMessage,
} from '@/lib/whot'
import type { WhotSession } from '@/types'
import { WhotCard as WhotCardShell } from '@/components/whot/WhotChrome'

const SHAPE_COLORS: Record<WhotShape, string> = {
  circle: 'from-blue-500/30 to-blue-600/20 border-blue-400/60',
  cross: 'from-green-500/30 to-green-600/20 border-green-400/60',
  triangle: 'from-amber-500/30 to-amber-600/20 border-amber-400/60',
  square: 'from-red-500/30 to-red-600/20 border-red-400/60',
  star: 'from-violet-500/30 to-violet-600/20 border-violet-400/60',
  whot: 'from-fuchsia-500/40 to-purple-600/30 border-fuchsia-400/70',
}

export function WhotPlayingCard({
  card,
  onClick,
  playable,
  selected,
  size = 'md',
}: {
  card: WhotCardType
  onClick?: () => void
  playable?: boolean
  selected?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const isWhot = card.number === 20
  const special = specialCardMessage(card.number)
  const sizeClass =
    size === 'lg' ? 'w-20 h-28 text-lg' : size === 'sm' ? 'w-12 h-16 text-xs' : 'w-16 h-22 text-sm'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={[
        'relative flex flex-col items-center justify-center rounded-xl border-2 bg-gradient-to-br font-black transition-all',
        sizeClass,
        SHAPE_COLORS[card.shape],
        onClick && playable !== false ? 'cursor-pointer hover:scale-105 hover:shadow-lg active:scale-95' : '',
        onClick && playable === false ? 'opacity-40 cursor-not-allowed' : '',
        selected ? 'ring-2 ring-[var(--primary)] scale-105' : '',
        !onClick ? 'cursor-default' : '',
      ].join(' ')}
    >
      <span className="text-2xl leading-none">{WHOT_SHAPE_EMOJI[card.shape]}</span>
      <span className="mt-1">{isWhot ? 'WHOT' : card.number}</span>
      {special && size !== 'sm' && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-muted whitespace-nowrap max-w-[90%] truncate">
          {card.number === 2 ? 'Pick 2' : card.number === 5 ? 'Pick 3' : card.number === 1 ? 'Hold' : card.number === 8 ? 'Skip' : card.number === 14 ? 'Market' : ''}
        </span>
      )}
    </button>
  )
}

export function WhotTable({
  session,
  players,
  myPlayerId,
  handCounts,
}: {
  session: WhotSession
  players: { id: string; name: string }[]
  myPlayerId: string | null
  handCounts: Record<string, number>
}) {
  const top = session.top_card
  const drawCount = (session.draw_pile as unknown[])?.length ?? 0
  const turnId = session.turn_order[session.current_turn_index]

  return (
    <WhotCardShell className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>Draw pile: {drawCount}</span>
        {(session.pick_two_stack ?? 0) > 0 && (
          <span className="font-bold text-orange-400">Pick 2 ×{session.pick_two_stack}</span>
        )}
        {(session.pick_five_stack ?? 0) > 0 && (
          <span className="font-bold text-red-400">Pick 3 ×{session.pick_five_stack}</span>
        )}
      </div>

      {session.required_shape && (
        <p className="text-center text-sm font-bold text-[var(--primary)]">
          Must match: {WHOT_SHAPE_LABELS[session.required_shape]}
        </p>
      )}
      {session.required_number != null && (
        <p className="text-center text-sm font-bold text-[var(--primary)]">
          Must match: number {session.required_number}
        </p>
      )}

      <div className="flex items-center justify-center gap-6 py-2">
        <div className="text-center">
          <div className="w-14 h-20 rounded-xl border-2 border-dashed border-[var(--border-strong)] flex items-center justify-center text-muted text-xs">
            🂠
          </div>
          <p className="text-[10px] text-muted mt-1">{drawCount} left</p>
        </div>
        {top ? (
          <div className="text-center">
            <WhotPlayingCard card={top} size="lg" />
            <p className="text-[10px] text-muted mt-1">Top card</p>
          </div>
        ) : (
          <p className="text-sm text-muted">No top card</p>
        )}
      </div>

      {session.status_message && (
        <p className="text-center text-sm text-muted border-t border-[var(--border)] pt-3">{session.status_message}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {players.map((p) => {
          const count = handCounts[p.id] ?? 0
          const isTurn = p.id === turnId
          const isMe = p.id === myPlayerId
          return (
            <div
              key={p.id}
              className={[
                'rounded-lg px-3 py-2 text-sm flex items-center justify-between',
                isTurn ? 'bg-[var(--primary)]/15 border border-[var(--primary)]/40 font-bold' : 'bg-[var(--surface-inset-bg)]',
              ].join(' ')}
            >
              <span className="truncate">
                {p.name}
                {isMe ? ' (you)' : ''}
              </span>
              <span className="text-muted ml-2 shrink-0">{count} 🃏</span>
            </div>
          )
        })}
      </div>
    </WhotCardShell>
  )
}

export function WhotHand({
  cards,
  session,
  onPlay,
  acting,
}: {
  cards: WhotCardType[]
  session: WhotSession
  onPlay: (cardId: string) => void
  acting: boolean
}) {
  if (cards.length === 0) {
    return (
      <WhotCardShell className="p-4 text-center text-sm text-muted">
        No cards left — you might have won!
      </WhotCardShell>
    )
  }

  return (
    <WhotCardShell className="p-4">
      <p className="text-xs font-semibold text-muted mb-3 uppercase tracking-wide">Your hand</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {cards.map((card) => {
          const playable = canPlayCard(card, session) && session.phase === 'playing'
          return (
            <WhotPlayingCard
              key={card.id}
              card={card}
              playable={playable}
              onClick={playable && !acting ? () => onPlay(card.id) : undefined}
            />
          )
        })}
      </div>
    </WhotCardShell>
  )
}

export function WhotChoosePanel({
  onChooseShape,
  onChooseNumber,
  acting,
}: {
  onChooseShape: (shape: WhotShape) => void
  onChooseNumber: (number: number) => void
  acting: boolean
}) {
  const shapes: WhotShape[] = ['circle', 'cross', 'triangle', 'square', 'star']
  const numbers = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14]

  return (
    <WhotCardShell className="p-4 space-y-4">
      <p className="text-center font-bold">You played WHOT — choose what opponents must match</p>
      <div>
        <p className="text-xs text-muted mb-2 uppercase tracking-wide">Pick a shape</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {shapes.map((shape) => (
            <button
              key={shape}
              type="button"
              disabled={acting}
              onClick={() => onChooseShape(shape)}
              className="px-4 py-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-inset-bg)] hover:bg-[var(--primary)]/10 font-semibold text-sm"
            >
              {WHOT_SHAPE_EMOJI[shape]} {WHOT_SHAPE_LABELS[shape]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-muted mb-2 uppercase tracking-wide">Or pick a number</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {numbers.map((n) => (
            <button
              key={n}
              type="button"
              disabled={acting}
              onClick={() => onChooseNumber(n)}
              className="w-10 h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-inset-bg)] hover:bg-[var(--primary)]/10 font-bold text-sm"
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </WhotCardShell>
  )
}
