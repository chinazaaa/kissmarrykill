'use client'

import { useCallback, useRef, useState, type RefObject } from 'react'
import type { Achievement } from '@/lib/achievements'
import { appDomain } from '@/lib/site'
import { captureElementAsImage } from '@/lib/capture-element-image'
import { shareImageBlob } from '@/lib/share-image'
import { useToast } from '@/components/ui/Toast'

function buildAchievementsShareText(achievements: Achievement[], gameTitle: string): string {
  const lines: string[] = [`🏆 ${gameTitle} — Achievements`, '']

  for (const achievement of achievements) {
    const who = achievement.participantName ? ` — ${achievement.participantName}` : ''
    lines.push(`${achievement.emoji} ${achievement.title}${who}`)
    lines.push(`   ${achievement.description}`)
  }

  lines.push('', `Play at ${appDomain()}`)
  return lines.join('\n')
}

export function ShareAchievements({
  captureRef,
  achievements,
  gameTitle,
}: {
  captureRef: RefObject<HTMLElement | null>
  achievements: Achievement[]
  gameTitle: string
}) {
  const { success, error } = useToast()
  const [sharing, setSharing] = useState(false)
  const sharingLock = useRef(false)

  const handleShare = useCallback(async () => {
    if (sharingLock.current) return

    const target = captureRef.current
    if (!target) {
      error('Nothing to share yet')
      return
    }

    sharingLock.current = true
    setSharing(true)
    try {
      const blob = await captureElementAsImage(target)
      const result = await shareImageBlob(blob, 'achievements.png')

      if (result === 'copied') {
        success('Image copied — paste into Stories or chat')
      } else if (result === 'shared') {
        success('Shared!')
      } else {
        success('Image downloaded')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return

      try {
        const text = buildAchievementsShareText(achievements, gameTitle)
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ text })
          return
        }
        await navigator.clipboard.writeText(text)
        success('Achievements copied to clipboard!')
      } catch {
        error(err instanceof Error ? err.message : 'Could not share achievements')
      }
    } finally {
      sharingLock.current = false
      setSharing(false)
    }
  }, [captureRef, achievements, gameTitle, success, error])

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={sharing}
      className="btn-secondary w-full flex items-center justify-center gap-2 disabled:opacity-50"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.5 2.5 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.474l6.733-3.367A2.5 2.5 0 0 1 13 4.5Z" />
      </svg>
      {sharing ? 'Sharing…' : 'Share Achievements'}
    </button>
  )
}
