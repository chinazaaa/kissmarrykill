'use client'

import { useParams } from 'next/navigation'
import { AudioChat } from '@/components/AudioChat'

export function HostAudioWrapper() {
  const { code } = useParams<{ code: string }>()
  if (!code) return null
  const gameCode = (Array.isArray(code) ? code[0] : code).toUpperCase()
  return <AudioChat roomCode={gameCode} playerName="Host" />
}
