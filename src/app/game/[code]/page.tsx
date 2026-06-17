'use client'

import { useParams } from 'next/navigation'
import { PollGamePlayerExperience } from '@/components/poll-game/PollGamePlayerExperience'

export default function GamePage() {
  const { code } = useParams<{ code: string }>()
  const gameCode = (Array.isArray(code) ? code[0] : code).toUpperCase()
  return <PollGamePlayerExperience gameCode={gameCode} />
}
