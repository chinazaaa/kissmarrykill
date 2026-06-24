'use client'

import { HostEndGameButton } from '@/components/ui/HostEndGameButton'
import { HostLobbyStartButton } from '@/components/host-lobby/HostLobbyStartButton'

type Props = {
  gameCode: string
  hostToken: string
  onStart: () => void
  onEnded?: () => void | Promise<unknown>
  canStart?: boolean
  starting?: boolean
  startDisabledHint?: string | null
  startDisabled?: boolean
  startLabel?: string
  endLabel?: string
  className?: string
}

export function HostLobbyWaitingFooter({
  gameCode,
  hostToken,
  onStart,
  onEnded,
  canStart = true,
  starting = false,
  startDisabledHint,
  startDisabled,
  startLabel = 'Start game',
  endLabel = 'End lobby',
  className = 'space-y-3',
}: Props) {
  const disabled = startDisabled ?? !canStart

  return (
    <div className={className}>
      <HostLobbyStartButton
        onClick={onStart}
        disabled={disabled}
        starting={starting}
        disabledHint={startDisabledHint}
        label={startLabel}
      />
      <HostEndGameButton
        gameCode={gameCode}
        hostToken={hostToken}
        onEnded={onEnded}
        label={endLabel}
        confirmTitle="Close this lobby?"
        confirmMessage="Players will be disconnected. You can start a new game from Play again afterward."
        className="btn-secondary w-full"
      />
    </div>
  )
}
