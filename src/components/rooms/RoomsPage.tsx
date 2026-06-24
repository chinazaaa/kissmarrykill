'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FateRoundLogo } from '@/components/FateRoundLogo'

export function RoomsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [roomName, setRoomName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const createRoom = async () => {
    const name = roomName.trim()
    if (!name) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create room'); return }
      if (data.creatorToken) {
        localStorage.setItem(`kmk_room_${data.roomCode}_creator`, data.creatorToken)
      }
      router.push(`/room/${data.roomCode}`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 4) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/rooms/${code}`)
      if (res.status === 404) { setError('Room not found. Check the code and try again.'); return }
      if (!res.ok) { setError('Something went wrong.'); return }
      router.push(`/room/${code}`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 flex items-center px-4 py-3 pointer-events-none">
        <Link href="/" className="pointer-events-auto">
          <FateRoundLogo className="h-8 w-auto max-w-[9.5rem] sm:max-w-[11rem]" />
        </Link>
      </header>

      <div className="page-wrap flex flex-col items-center justify-center px-4 pt-16 pb-8">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center space-y-1">
            <div className="text-4xl">🏠</div>
            <h1 className="text-2xl font-black tracking-tight gradient-title">Game Rooms</h1>
            <p className="text-muted text-sm">
              A permanent home base for your friend group. Play multiple games, track stats, and chat — no sign-up needed.
            </p>
          </div>

          <div className="glass-card-strong p-4 space-y-4">
            <div className="flex rounded-xl border border-[var(--border)] overflow-hidden">
              <button
                type="button"
                onClick={() => { setTab('create'); setError('') }}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${tab === 'create' ? 'bg-[var(--primary)] text-white' : 'text-muted hover:text-body'}`}
              >
                Create Room
              </button>
              <button
                type="button"
                onClick={() => { setTab('join'); setError('') }}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${tab === 'join' ? 'bg-[var(--primary)] text-white' : 'text-muted hover:text-body'}`}
              >
                Join Room
              </button>
            </div>

            {tab === 'create' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="label-caps">Room name</label>
                  <input
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createRoom()}
                    placeholder="e.g. The Office Crew"
                    maxLength={50}
                    className="input-field"
                    autoFocus
                  />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                  type="button"
                  onClick={createRoom}
                  disabled={!roomName.trim() || loading}
                  className="btn-primary"
                >
                  {loading ? 'Creating…' : 'Create Room'}
                </button>
              </div>
            )}

            {tab === 'join' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="label-caps">Room code</label>
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                    placeholder="Enter code"
                    maxLength={6}
                    className="input-field text-center text-xl tracking-[0.2em] font-mono font-bold"
                    autoFocus
                  />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                  type="button"
                  onClick={joinRoom}
                  disabled={joinCode.length < 4 || loading}
                  className="btn-primary"
                >
                  {loading ? 'Looking up…' : 'Enter Room'}
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-faint text-xs">
            <Link href="/" className="hover:text-body transition-colors">← Back to home</Link>
          </p>
        </div>
      </div>
    </>
  )
}
