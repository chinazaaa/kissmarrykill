'use client'

type Props = {
  onClick: () => void
  disabled?: boolean
  starting?: boolean
  disabledHint?: string | null
  className?: string
  label?: string
}

export function HostLobbyStartButton({
  onClick,
  disabled = false,
  starting = false,
  disabledHint,
  className = 'btn-primary w-full',
  label = 'Start game',
}: Props) {
  const showHint = disabled && !starting && disabledHint

  return (
    <div className="space-y-2">
      <button type="button" onClick={onClick} disabled={disabled || starting} className={className}>
        {starting ? 'Starting…' : label}
      </button>
      {showHint ? <p className="text-faint text-xs text-center leading-relaxed">{disabledHint}</p> : null}
    </div>
  )
}
