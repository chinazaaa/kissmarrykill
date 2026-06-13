'use client'
import { useEffect, useRef } from 'react'
import type { Confession } from '@/types'

interface ConfessionsTickerProps {
  confessions: Confession[]
}

export function ConfessionsTicker({ confessions }: ConfessionsTickerProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new confessions arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [confessions.length])

  if (confessions.length === 0) return null

  return (
    <div className="glass-card border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-muted text-xs uppercase tracking-wider">🤫 Anonymous hot takes</p>
        <span className="text-faint text-xs tabular-nums">{confessions.length}</span>
      </div>

      <div ref={containerRef} className="max-h-48 overflow-y-auto space-y-2 scrollbar-thin">
        {confessions.map((c, i) => (
          <div
            key={c.id}
            className="confession-slide-in px-3 py-2 rounded-xl bg-white/5 border border-white/5"
            style={{ animationDelay: `${Math.min(i * 60, 300)}ms` }}
          >
            <p className="text-body-muted text-sm italic opacity-80">&ldquo;{c.text}&rdquo;</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <style jsx>{`
        @keyframes confessionSlideIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .confession-slide-in {
          animation: confessionSlideIn 0.35s ease-out both;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 2px;
        }
      `}</style>
    </div>
  )
}
