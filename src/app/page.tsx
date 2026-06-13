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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Background gradient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center space-y-8 max-w-md w-full">
        {/* Title */}
        <div className="space-y-3">
          <div className="flex justify-center gap-4 text-5xl mb-2">
            <span>❤️</span><span>💍</span><span>💀</span>
          </div>
          <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-pink-400 via-purple-400 to-rose-400 bg-clip-text text-transparent">
            Kiss Marry Kill
          </h1>
          <p className="text-zinc-400 text-lg">The party game that reveals everything</p>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <button
            onClick={() => router.push('/create')}
            className="w-full py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-rose-500 text-white text-xl font-bold rounded-2xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-purple-500/20"
          >
            Create Game
          </button>

          <div className="relative flex items-center gap-2">
            <div className="flex-1 h-px bg-[#262626]" />
            <span className="text-zinc-600 text-sm">or join with code</span>
            <div className="flex-1 h-px bg-[#262626]" />
          </div>

          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && join()}
              placeholder="ABC123"
              maxLength={6}
              className="flex-1 bg-[#161616] text-white border border-[#262626] rounded-xl px-4 py-3 text-center text-xl tracking-widest font-mono font-bold focus:outline-none focus:border-purple-500 transition-colors placeholder:text-zinc-700 placeholder:tracking-widest"
            />
            <button
              onClick={join}
              disabled={code.length < 4}
              className="px-6 py-3 bg-[#161616] text-white border border-[#262626] rounded-xl hover:border-purple-500 transition-colors font-bold disabled:opacity-40"
            >
              Join
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-zinc-700 text-sm">No sign-up required</p>
      </div>
    </div>
  )
}
