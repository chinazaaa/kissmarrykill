'use client'

import { useState } from 'react'

type Props = {
  title?: string
  summary?: string
  status?: string | null
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}

function Chevron({ up }: { up?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={['h-3.5 w-3.5 shrink-0 transition-transform', up ? 'rotate-180' : ''].join(' ')}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function HostLobbySettingsSection({
  title = 'Before you start',
  summary,
  status,
  defaultOpen = false,
  children,
  className = '',
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      className={[
        'rounded-2xl border border-[color-mix(in_srgb,var(--primary)_14%,var(--border))]',
        'bg-[var(--card-strong)]/95 overflow-hidden',
        className,
      ].join(' ')}
    >
      <div className="px-4 py-3.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="label-caps">{title}</p>
            {status ? (
              <span
                className={[
                  'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full',
                  status === 'Saved'
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10'
                    : 'text-muted bg-[var(--surface-inset-bg)]',
                ].join(' ')}
              >
                {status}
              </span>
            ) : null}
          </div>
          {summary ? (
            <p className={`text-muted text-xs mt-1 leading-snug ${open ? '' : 'truncate'}`}>{summary}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={[
            'shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2',
            'text-xs font-semibold whitespace-nowrap transition-all',
            open
              ? 'btn-secondary btn-fit'
              : 'border border-[color-mix(in_srgb,var(--primary)_28%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_10%,var(--card))] text-[var(--primary-strong)] shadow-[0_1px_0_color-mix(in_srgb,var(--primary)_18%,transparent)] hover:bg-[color-mix(in_srgb,var(--primary)_16%,var(--card))]',
          ].join(' ')}
        >
          {open ? 'Done' : 'Edit settings'}
          <Chevron up={open} />
        </button>
      </div>

      {open ? (
        <div className="px-4 pb-4 pt-0 border-t border-[color-mix(in_srgb,var(--primary)_10%,var(--border))] space-y-4 divide-y divide-[color-mix(in_srgb,var(--primary)_8%,var(--border))] [&>section:not(:first-child)]:pt-4">
          {children}
        </div>
      ) : null}
    </div>
  )
}
