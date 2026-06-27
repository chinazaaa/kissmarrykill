'use client'

import { useParams } from 'next/navigation'
import { PollGamePlayerExperience } from '@/components/poll-game/PollGamePlayerExperience'
import { AudioChat } from '@/components/AudioChat'
import { getPlayerSession } from '@/lib/utils'
import { useEffect, useState } from 'react'

export default function GamePage() {
  const { code } = useParams<{ code: string }>()
  const gameCode = (Array.isArray(code) ? code[0] : code).toUpperCase()
  const [playerName, setPlayerName] = useState<string | null>(null)

  useEffect(() => {
    const checkSession = () => {
      const session = getPlayerSession(gameCode)
      if (session?.playerName) {
        setPlayerName(session.playerName)
      } else {
        setPlayerName(null)
      }
    }
    checkSession()
    const timer = setInterval(checkSession, 1500)
    return () => clearInterval(timer)
  }, [gameCode])

  return (
    <>
      <PollGamePlayerExperience gameCode={gameCode} />
      {playerName && <AudioChat roomCode={gameCode} playerName={playerName} />}
    </>
  )
}
