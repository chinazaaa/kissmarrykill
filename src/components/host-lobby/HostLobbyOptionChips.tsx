'use client'

import { Chip } from '@/components/ui/PageShell'

export type HostLobbyOption = {
  value: number
  label: string
}

export function HostLobbyOptionChips({
  value,
  options,
  onChange,
  disabled,
}: {
  value: number
  options: HostLobbyOption[]
  onChange: (value: number) => void
  disabled?: boolean
}) {
  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : undefined}>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <Chip
            key={opt.value}
            active={value === opt.value}
            onClick={() => onChange(opt.value)}
            className="min-w-[2.75rem] px-3 py-2 text-sm font-semibold"
          >
            {opt.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}
