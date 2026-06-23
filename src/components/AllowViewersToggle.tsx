'use client'

import { SegmentedControl } from '@/components/ui/CreateWizard'
import { gameAllowsLatePlayerJoin, clampLateJoinPolicyForGameType, type LateJoinPolicy } from '@/lib/viewers'
import type { GameType } from '@/types'

const LATE_JOIN_OPTIONS: {
  value: LateJoinPolicy
  label: string
  hint: string
}[] = [
  {
    value: 'lobby_only',
    label: 'Lobby only',
    hint: 'No one can join after the game starts',
  },
  {
    value: 'viewers_only',
    label: 'Viewers only',
    hint: 'Late joiners can watch live — not play',
  },
  {
    value: 'viewers_and_players',
    label: 'Viewers & players',
    hint: 'Late joiners choose to watch or join as a player',
  },
]

export function LateJoinPolicyToggle({
  value,
  onChange,
  disabled,
  gameType,
}: {
  value: LateJoinPolicy
  onChange: (value: LateJoinPolicy) => void
  disabled?: boolean
  gameType?: GameType
}) {
  const options =
    gameType && !gameAllowsLatePlayerJoin(gameType)
      ? LATE_JOIN_OPTIONS.filter((option) => option.value !== 'viewers_and_players')
      : LATE_JOIN_OPTIONS

  const effectiveValue = gameType ? clampLateJoinPolicyForGameType(value, gameType) : value

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : undefined}>
      <SegmentedControl value={effectiveValue} onChange={(v) => onChange(v as LateJoinPolicy)} options={options} />
    </div>
  )
}

/** @deprecated Use LateJoinPolicyToggle */
export function AllowViewersToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <LateJoinPolicyToggle
      value={value ? 'viewers_and_players' : 'lobby_only'}
      onChange={(policy) => onChange(policy !== 'lobby_only')}
      disabled={disabled}
    />
  )
}
