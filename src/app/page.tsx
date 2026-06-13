'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [code, setCode] = useState('')

  const join = () => {
    const c = code.trim().toUpperCase()
    if (c.length >= 4) router.push(`/game/${c}`)
  }

  return (
    <div className="page-wrap flex flex-col items-center justify-center px-4 py-12">
      <div className="relative z-10 text-center space-y-8 max-w-md w-full">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 rounded-full glass-card px-5 py-2 text-2xl">
            <span>❤️</span>
            <span>💍</span>
            <span>🔥</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight gradient-title">
              Kiss Marry Smash
            </h1>
            <p className="text-muted text-lg">The party game that reveals everything</p>
          </div>
        </div>

        <div className="glass-card-strong p-6 space-y-5 text-left">
          <button onClick={() => router.push('/create')} className="btn-primary">
            Create Game
          </button>

          <div className="flex items-center gap-3">
            <div className="divider-soft" />
            <span className="text-faint text-sm shrink-0">or join with code</span>
            <div className="divider-soft" />
          </div>

          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && join()}
              placeholder="ABC123"
              maxLength={6}
              className="input-field flex-1 text-center text-xl tracking-[0.25em] font-mono font-bold"
            />
            <button onClick={join} disabled={code.length < 4} className="btn-secondary shrink-0 px-5">
              Join
            </button>
          </div>
        </div>

        <p className="text-faint text-sm">No sign-up required · works on any device</p>
      </div>
    </div>
  )
}
