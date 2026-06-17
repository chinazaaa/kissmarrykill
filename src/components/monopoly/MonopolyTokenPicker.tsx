'use client'

import {
  MONOPOLY_PLAYER_TOKENS,
  type MonopolyTokenId,
} from '@/lib/monopoly-tokens'
import { tokenColorForOrder } from '@/components/monopoly/monopoly-ui'

export function MonopolyTokenPicker({
  selectedTokenId,
  onSelect,
  takenTokenIds,
  tokenOwners = new Map<string, string>(),
  disabled = false,
}: {
  selectedTokenId: MonopolyTokenId | null
  onSelect: (tokenId: MonopolyTokenId) => void
  takenTokenIds: Set<string>
  tokenOwners?: Map<string, string>
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {MONOPOLY_PLAYER_TOKENS.map((token, index) => {
          const taken = takenTokenIds.has(token.id)
          const takenBy = tokenOwners.get(token.id)
          const selected = selectedTokenId === token.id
          const colors = tokenColorForOrder(index)

          return (
            <button
              key={token.id}
              type="button"
              disabled={disabled || taken}
              onClick={() => onSelect(token.id)}
              title={taken ? `${token.label} — taken by ${takenBy ?? 'another player'}` : token.label}
              aria-pressed={selected}
              className={[
                'flex flex-col items-center gap-1 rounded-xl border-2 px-1.5 py-2.5 transition-all min-h-[5.5rem]',
                taken
                  ? 'border-[var(--border-strong)] bg-[var(--surface-inset-bg)] opacity-45 cursor-not-allowed'
                  : selected
                    ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_15%,var(--surface-inset-bg))] shadow-md ring-2 ring-[color-mix(in_srgb,var(--primary)_30%,transparent)]'
                    : 'border-[var(--border-strong)] bg-[var(--card-strong)] hover:border-[color-mix(in_srgb,var(--primary)_45%,var(--border-strong))] hover:shadow-sm',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full text-xl sm:text-2xl ring-2',
                  taken ? 'bg-neutral-400/30 ring-neutral-400/40 grayscale' : [colors.bg, colors.ring].join(' '),
                ].join(' ')}
              >
                {token.emoji}
              </span>
              <span className="text-[10px] font-semibold text-muted leading-tight text-center">{token.label}</span>
              {taken ? (
                <span className="text-[8px] font-bold uppercase text-faint leading-tight text-center px-0.5">
                  {takenBy ? `${takenBy.slice(0, 8)}${takenBy.length > 8 ? '…' : ''}` : 'Taken'}
                </span>
              ) : selected ? (
                <span className="text-[8px] font-bold uppercase text-[var(--primary)]">Selected</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
