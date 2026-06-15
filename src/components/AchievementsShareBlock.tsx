'use client'

import { useRef } from 'react'
import type { Achievement } from '@/lib/achievements'
import { AchievementBadges } from '@/components/AchievementBadges'
import { ShareAchievements } from '@/components/ShareAchievements'

export function AchievementsShareBlock({
  achievements,
  gameTitle,
}: {
  achievements: Achievement[]
  gameTitle: string
}) {
  const captureRef = useRef<HTMLDivElement>(null)

  if (achievements.length === 0) return null

  return (
    <>
      <div ref={captureRef}>
        <AchievementBadges achievements={achievements} />
      </div>
      <ShareAchievements captureRef={captureRef} achievements={achievements} gameTitle={gameTitle} />
    </>
  )
}
