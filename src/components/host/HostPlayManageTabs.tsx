'use client'

export function HostPlayManageTabs({
  tab,
  onTabChange,
}: {
  tab: 'play' | 'manage'
  onTabChange: (tab: 'play' | 'manage') => void
}) {
  return (
    <div className="flex gap-2 p-1 rounded-xl bg-[var(--surface-inset-bg)] border border-[var(--border-strong)]">
      <button
        type="button"
        onClick={() => onTabChange('play')}
        className={[
          'flex-1 rounded-lg py-3 text-sm font-bold transition-colors',
          tab === 'play' ? 'bg-[var(--card-strong)] shadow-sm' : 'text-muted',
        ].join(' ')}
      >
        Play
      </button>
      <button
        type="button"
        onClick={() => onTabChange('manage')}
        className={[
          'flex-1 rounded-lg py-3 text-sm font-bold transition-colors',
          tab === 'manage' ? 'bg-[var(--card-strong)] shadow-sm' : 'text-muted',
        ].join(' ')}
      >
        Manage
      </button>
    </div>
  )
}
