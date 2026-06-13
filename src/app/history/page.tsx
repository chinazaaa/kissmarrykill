'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function HistorySearchPage() {
  const router = useRouter()
  const [code, setCode] = useState('')

  const search = () => {
    const c = code.trim().toUpperCase()
    if (c.length >= 4) router.push(`/history/${c}`)
  }

  return (
    <div className="page-wrap flex flex-col items-center justify-center px-4 py-12">
      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <p className="text-3xl">📜</p>
          <h1 className="text-3xl font-black tracking-tight gradient-title">Game history</h1>
          <p className="text-muted text-sm">Look up past votes by game code</p>
        </div>

        <div className="glass-card-strong p-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-faint text-xs uppercase tracking-wider">Game ID</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="ABC123"
              maxLength={6}
              autoFocus
              className="input-field w-full text-center text-xl tracking-[0.25em] font-mono font-bold"
            />
          </label>
          <button onClick={search} disabled={code.length < 4} className="btn-primary w-full">
            View history
          </button>
        </div>

        <p className="text-center">
          <Link href="/" className="text-faint text-sm hover:text-white transition-colors">
            ← Back home
          </Link>
        </p>
      </div>
    </div>
  )
}
