'use client'

import { Modal } from '@/components/ui/Modal'
import { themeStyleVars, type ThemeConfig } from '@/lib/themes'

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function ThemeSampleRoom({ theme }: { theme: ThemeConfig }) {
  const hasRoomVars = Object.keys(theme.cssVars).length > 0
  const roomStyle = themeStyleVars(theme.id)

  return (
    <div
      className="rounded-2xl overflow-hidden border border-[var(--border)] shadow-lg"
      style={roomStyle}
      {...(!hasRoomVars ? { 'data-theme': 'dark' as const } : {})}
    >
      <div
        className="p-5 space-y-4"
        style={{
          backgroundColor: 'var(--background)',
          backgroundImage: 'var(--bg-gradient)',
          color: 'var(--foreground)',
        }}
      >
        <div className="text-center space-y-2">
          <p className="text-2xl leading-none">{theme.emoji}</p>
          <h3 className="text-lg font-black tracking-tight gradient-title">Friday Night</h3>
          <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-inset-bg)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Kiss Marry Kill
          </span>
        </div>

        <div className="glass-card p-3 space-y-2">
          <p className="label-caps text-[10px]">Players in lobby</p>
          <div className="flex items-center gap-2">
            {['Alex', 'Sam', 'Jordan'].map((name) => (
              <div key={name} className="flex flex-col items-center gap-1">
                <div className="avatar w-8 h-8 text-xs">{name.charAt(0)}</div>
                <span className="text-[10px] text-muted truncate max-w-[3.5rem]">{name}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1 opacity-60">
              <div className="avatar w-8 h-8 text-xs border-dashed">+</div>
              <span className="text-[10px] text-faint">Join</span>
            </div>
          </div>
        </div>

        <div className="glass-card-strong p-4 space-y-3">
          <p className="text-sm font-semibold text-center text-body">Round 1 — pick your fate</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { emoji: '💋', label: 'Kiss', color: 'var(--kiss)' },
              { emoji: '💍', label: 'Marry', color: 'var(--marry)' },
              { emoji: '💀', label: 'Kill', color: 'var(--kill)' },
            ].map((slot) => (
              <div
                key={slot.label}
                className="surface-inset rounded-xl px-2 py-2.5 text-center space-y-0.5"
              >
                <span className="text-base leading-none">{slot.emoji}</span>
                <p className="text-[10px] font-bold" style={{ color: slot.color }}>
                  {slot.label}
                </p>
              </div>
            ))}
          </div>
          <button type="button" className="btn-primary btn-fit mx-auto px-6 py-2 text-sm pointer-events-none">
            Submit vote
          </button>
        </div>
      </div>
    </div>
  )
}

export function ThemePreviewModal({
  theme,
  open,
  onClose,
  onSelect,
}: {
  theme: ThemeConfig | null
  open: boolean
  onClose: () => void
  onSelect?: (themeId: ThemeConfig['id']) => void
}) {
  if (!theme) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${theme.emoji} ${theme.label}`}
      subtitle="Sample of how your game room will look"
      size="md"
    >
      <div className="space-y-5">
        <ThemeSampleRoom theme={theme} />
        {onSelect && (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary px-5 py-2.5 text-sm">
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onSelect(theme.id)
                onClose()
              }}
              className="btn-primary btn-fit px-5 py-2.5 text-sm"
            >
              Use this theme
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export function ThemePreviewCard({
  theme,
  selected,
  onClick,
  onPreview,
}: {
  theme: ThemeConfig
  selected: boolean
  onClick: () => void
  onPreview: () => void
}) {
  return (
    <div
      className={`relative flex flex-col items-center rounded-xl border transition-all ${
        selected
          ? 'border-[var(--primary)] shadow-[0_0_0_1px_var(--primary)]'
          : 'border-[var(--border)] hover:border-[var(--border-strong)]'
      }`}
      style={{ minWidth: '4.5rem' }}
    >
      <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5 px-3 py-2.5 w-full">
        <div className="flex gap-1">
          <span className="block w-4 h-4 rounded-full border border-black/10" style={{ background: theme.preview.bg }} />
          <span
            className="block w-4 h-4 rounded-full border border-black/10"
            style={{ background: theme.preview.accent }}
          />
          <span
            className="block w-4 h-4 rounded-full border border-black/10"
            style={{ background: theme.preview.text }}
          />
        </div>
        <span className="text-xs font-medium text-body">
          {theme.emoji} {theme.label}
        </span>
      </button>
      <button
        type="button"
        onClick={onPreview}
        className="absolute top-1 right-1 w-5 h-5 rounded-md flex items-center justify-center text-faint hover:text-body hover:bg-[var(--surface-inset-bg)] transition-colors"
        aria-label={`Preview ${theme.label} theme`}
        title="Preview room"
      >
        <EyeIcon />
      </button>
    </div>
  )
}
