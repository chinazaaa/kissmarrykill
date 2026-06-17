'use client'

import type { ReactNode } from 'react'

/** Main game content left, live leaderboard right on sm+; stacked on mobile. */
export function LiveLeaderboardLayout({
  children,
  sidebar,
}: {
  children: ReactNode
  sidebar: ReactNode
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-4 items-start">
      <div className="min-w-0 space-y-4">{children}</div>
      <aside className="min-w-0">{sidebar}</aside>
    </div>
  )
}
