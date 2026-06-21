'use client'

type Props = {
  title?: string
  children: React.ReactNode
  className?: string
}

export function HostLobbySettingsSection({
  title = 'Game settings',
  children,
  className = '',
}: Props) {
  return (
    <div
      className={[
        'rounded-2xl border border-[color-mix(in_srgb,var(--primary)_14%,var(--border))]',
        'bg-[var(--card-strong)]/95 p-5 space-y-4',
        className,
      ].join(' ')}
    >
      <p className="label-caps">{title}</p>
      {children}
    </div>
  )
}
