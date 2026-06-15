'use client'

import type { ReactNode } from 'react'
import { GameTypeBadge } from '@/components/GameTypeBadge'
import { gameTypeConfig } from '@/lib/game-types'

export function MonopolyShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode
  title?: string
  subtitle?: string
}) {
  const cfg = gameTypeConfig('monopoly')

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0a1628] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(34,197,94,0.35), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(20,83,45,0.5), transparent)',
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-2xl px-4 pb-28 pt-5 sm:pt-8 space-y-5">
        {(title || subtitle) && (
          <header className="text-center space-y-2">
            <div className="inline-flex items-center justify-center gap-2">
              <span className="text-3xl drop-shadow-lg">{cfg.card.emoji}</span>
              <GameTypeBadge gameType="monopoly" />
            </div>
            {title && (
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">{title}</h1>
            )}
            {subtitle && <p className="text-sm text-emerald-100/70 max-w-md mx-auto">{subtitle}</p>}
          </header>
        )}
        {children}
      </div>
    </div>
  )
}

export function MonopolyGlassCard({
  children,
  className = '',
  glow,
}: {
  children: ReactNode
  className?: string
  glow?: 'amber' | 'emerald' | 'none'
}) {
  const glowClass =
    glow === 'amber'
      ? 'shadow-[0_0_40px_rgba(251,191,36,0.15)] border-amber-400/30'
      : glow === 'emerald'
        ? 'shadow-[0_0_40px_rgba(52,211,153,0.12)] border-emerald-400/25'
        : 'border-white/10'

  return (
    <div
      className={[
        'rounded-2xl border bg-white/[0.06] backdrop-blur-xl',
        glowClass,
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function MonopolyStatusBanner({ message, isMyTurn }: { message: string; isMyTurn?: boolean }) {
  if (!message) return null
  return (
    <MonopolyGlassCard
      glow={isMyTurn ? 'amber' : 'emerald'}
      className={['px-4 py-3 text-sm leading-relaxed', isMyTurn ? 'text-amber-100' : 'text-emerald-100/90'].join(' ')}
    >
      {isMyTurn && (
        <span className="mr-2 inline-block rounded-full bg-amber-400/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
          Your turn
        </span>
      )}
      {message}
    </MonopolyGlassCard>
  )
}

export function MonopolyPrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  variant = 'gold',
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'gold' | 'green' | 'ghost'
}) {
  const styles =
    variant === 'gold'
      ? 'bg-gradient-to-b from-amber-400 to-amber-600 text-amber-950 shadow-[0_4px_0_#b45309,0_8px_24px_rgba(251,191,36,0.35)] hover:from-amber-300 hover:to-amber-500 active:shadow-[0_2px_0_#b45309] active:translate-y-0.5'
      : variant === 'green'
        ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-[0_4px_0_#047857,0_8px_24px_rgba(16,185,129,0.3)] hover:from-emerald-400 hover:to-emerald-600 active:shadow-[0_2px_0_#047857] active:translate-y-0.5'
        : 'bg-white/10 text-white border border-white/15 hover:bg-white/15'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={[
        'w-full rounded-2xl px-5 py-4 text-base font-black tracking-wide transition-all',
        'disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none',
        styles,
      ].join(' ')}
    >
      {loading ? '…' : children}
    </button>
  )
}

export function MonopolySecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-bold text-white/90 hover:bg-white/10 disabled:opacity-40 transition-colors"
    >
      {children}
    </button>
  )
}

export function MonopolyCashBadge({ amount, label = 'Your cash' }: { amount: number; label?: string }) {
  return (
    <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-emerald-900/40 px-4 py-2.5 text-right shadow-lg">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-200/60">{label}</p>
      <p className="text-2xl font-black tabular-nums text-emerald-300">${amount.toLocaleString()}</p>
    </div>
  )
}

export function MonopolyTurnStrip({
  turnName,
  isMyTurn,
  phase,
  myName,
}: {
  turnName: string
  isMyTurn?: boolean
  phase?: string
  myName?: string | null
}) {
  return (
    <div className="flex flex-col gap-2 min-w-0 flex-1">
      {myName && (
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">You</span>
          <span className="text-sm font-bold text-white truncate max-w-[140px]">{myName}</span>
        </div>
      )}
      <MonopolyGlassCard className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-200/50">Current turn</p>
          <p className="text-lg font-black text-white truncate">
            {isMyTurn ? 'Your turn' : turnName}
          </p>
          {isMyTurn && myName && (
            <p className="text-xs text-emerald-200/60 truncate">{myName}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          {isMyTurn ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              Roll
            </span>
          ) : (
            <span className="text-xs text-emerald-200/50 capitalize">{phase?.replace('_', ' ') ?? 'Waiting'}</span>
          )}
        </div>
      </MonopolyGlassCard>
    </div>
  )
}

export function MonopolyModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  colorBar,
}: {
  open: boolean
  onClose?: () => void
  title: string
  subtitle?: string
  children: ReactNode
  colorBar?: string
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={[
          'relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/15',
          'bg-[#0f1f35] shadow-[0_24px_80px_rgba(0,0,0,0.6)]',
          'animate-in fade-in slide-in-from-bottom-4 duration-200',
        ].join(' ')}
        role="dialog"
        aria-modal="true"
      >
        {colorBar && <div className={['h-2 w-full', colorBar].join(' ')} />}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="text-center">
            {subtitle && (
              <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300/80">{subtitle}</p>
            )}
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">{title}</h2>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export function MonopolyLoadingScreen() {
  return (
    <MonopolyShell>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-bounce">🎲</div>
          <p className="text-emerald-200/70 animate-pulse font-medium">Setting up the board…</p>
        </div>
      </div>
    </MonopolyShell>
  )
}
