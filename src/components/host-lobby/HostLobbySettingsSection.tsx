'use client'

type Props = {
  title?: string
  subtitle?: string
  summary?: string
  status?: string | null
  children: React.ReactNode
  className?: string
}

export function HostLobbySettingsSection({
  title = 'Before you start',
  subtitle,
  summary,
  status,
  children,
  className = '',
}: Props) {
  return (
    <div
      className={[
        'rounded-2xl border border-[color-mix(in_srgb,var(--primary)_14%,var(--border))]',
        'bg-[var(--card-strong)]/95 overflow-hidden',
        className,
      ].join(' ')}
    >
      <div className="px-5 pt-5 pb-4 border-b border-[color-mix(in_srgb,var(--primary)_10%,var(--border))] space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="label-caps">{title}</p>
            {subtitle ? <p className="text-faint text-xs leading-relaxed">{subtitle}</p> : null}
          </div>
          {status ? (
            <span
              className={[
                'shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full',
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
          <p className="text-muted text-sm leading-relaxed rounded-xl surface-inset px-3 py-2">{summary}</p>
        ) : null}
      </div>

      <div className="px-5 py-5 space-y-6 divide-y divide-[color-mix(in_srgb,var(--primary)_8%,var(--border))] [&>section:not(:first-child)]:pt-6">
        {children}
      </div>
    </div>
  )
}
