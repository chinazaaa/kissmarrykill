'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { AudioChat } from '@/components/AudioChat'

/** Stable per-tab identity so multiple host tabs in the same room don't
 * collide on the LiveKit identity (which must be unique per participant). */
function useHostIdentity(gameCode: string): string {
  const [hostId] = useState(() => {
    const key = `host-audio-id:${gameCode}`
    if (typeof window === 'undefined') return `host-${gameCode}`
    const existing = window.sessionStorage.getItem(key)
    if (existing) return existing
    const generated =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `host-${crypto.randomUUID()}`
        : `host-${Math.random().toString(36).slice(2)}`
    window.sessionStorage.setItem(key, generated)
    return generated
  })
  return hostId
}

export function HostAudioWrapper() {
  const { code } = useParams<{ code: string }>()
  const searchParams = useSearchParams()
  const gameCode = code ? (Array.isArray(code) ? code[0] : code).toUpperCase() : ''
  const hostIdentity = useHostIdentity(gameCode)
  const hostToken = searchParams.get('token') ?? ''
  if (!gameCode || !hostToken) return null
  return (
    <AudioChat
      roomCode={gameCode}
      playerName="Host"
      identity={hostIdentity}
      auth={{ kind: 'host', token: hostToken }}
    />
  )
}
