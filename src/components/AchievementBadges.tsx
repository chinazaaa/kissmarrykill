'use client'

import type { Achievement } from '@/lib/achievements'

export function AchievementBadges({ achievements }: { achievements: Achievement[] }) {
  if (achievements.length === 0) return null

  return (
    <div>
      <h2 className="text-muted text-xs uppercase tracking-wider mb-4">Achievements</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {achievements.map((a) => (
          <div
            key={a.id}
            className="glass-card relative overflow-hidden border border-[var(--primary)]/20 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            {/* shimmer overlay */}
            <div className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0 mt-0.5">{a.emoji}</span>
              <div className="min-w-0">
                <p className="font-bold text-body text-sm leading-tight">{a.title}</p>
                {a.participantName && (
                  <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--primary)' }}>
                    {a.participantName}
                  </p>
                )}
                <p className="text-muted text-xs mt-1 leading-snug">{a.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
