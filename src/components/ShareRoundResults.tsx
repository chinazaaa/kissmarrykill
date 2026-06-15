'use client'

import { useCallback, useRef, useState, type RefObject } from 'react'
import type { Game, Participant, Player, Round, Vote } from '@/types'
import { appDomain } from '@/lib/site'
import { buildRoundShareCardContent } from '@/lib/share-round-content'
import { captureElementAsImage } from '@/lib/capture-element-image'
import { shareImageBlob } from '@/lib/share-image'
import { useToast } from '@/components/ui/Toast'

function buildRoundShareText({
  game,
  round,
  votes,
  participants,
  players,
}: {
  game: Game
  round: Round
  votes: Vote[]
  participants: Participant[]
  players: Player[]
}): string {
  const card = buildRoundShareCardContent({ game, round, votes, participants, players })
  const lines: string[] = [`${card.headerEmoji} ${card.gameLabel} - ${card.roundLabel}`]

  if (card.subtitle) lines.push(card.subtitle)
  for (const row of card.rows) {
    lines.push(`${row.emoji} ${row.label}: ${row.value}`)
  }
  lines.push('', `Play at ${appDomain()}`)

  return lines.join('\n')
}

export function ShareRoundResults({
  captureRef,
  game,
  round,
  votes,
  participants,
  players,
}: {
  captureRef: RefObject<HTMLElement | null>
  game: Game
  round: Round
  votes: Vote[]
  participants: Participant[]
  players: Player[]
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
      const result = await shareImageBlob(blob, 'round-results.png')

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
        const text = buildRoundShareText({ game, round, votes, participants, players })
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ text })
          return
        }
        await navigator.clipboard.writeText(text)
        success('Results copied to clipboard!')
      } catch {
        error(err instanceof Error ? err.message : 'Could not share results')
      }
    } finally {
      sharingLock.current = false
      setSharing(false)
    }
  }, [captureRef, game, round, votes, participants, players, success, error])

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
      {sharing ? 'Sharing…' : 'Share Round'}
    </button>
  )
}
