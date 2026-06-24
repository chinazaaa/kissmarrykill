'use client'

import { useEffect, useState } from 'react'

export function useGameRoom(gameCode: string | null) {
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!gameCode)

  useEffect(() => {
    if (!gameCode) {
      setRoomCode(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    fetch(`/api/games/${encodeURIComponent(gameCode)}/room`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.roomCode) {
          setRoomCode(String(data.roomCode).toUpperCase())
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [gameCode])

  return { roomCode, loading, fromRoom: !!roomCode }
}
