'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

const REACTIONS = [
  { emoji: '😂', label: 'Laughing' },
  { emoji: '😱', label: 'Shocked' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💀', label: 'Dead' },
  { emoji: '👀', label: 'Eyes' },
] as const

interface FloatingEmoji {
  id: number
  emoji: string
}

const STYLE_ID = 'reaction-bar-styles'
function ensureStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes reaction-float-up {
      0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
      100% { opacity: 0; transform: translateX(-50%) translateY(-48px) scale(1.4); }
    }
  `
  document.head.appendChild(style)
}

export default function ReactionBar({ className = '' }: { className?: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [floaters, setFloaters] = useState<FloatingEmoji[]>([])
  const idRef = useRef(0)
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => {
    ensureStyles()
    const timers = timersRef.current
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [])

  const handleClick = useCallback((emoji: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(emoji)) next.delete(emoji)
      else next.add(emoji)
      return next
    })

    const id = idRef.current++
    setFloaters((prev) => [...prev, { id, emoji }])
    const timer = setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => f.id !== id))
      timersRef.current.delete(timer)
    }, 700)
    timersRef.current.add(timer)
  }, [])

  return (
    <div className={`relative flex items-center justify-center gap-2 ${className}`}>
      {REACTIONS.map(({ emoji, label }) => {
        const isSelected = selected.has(emoji)
        return (
          <button
            key={emoji}
            type="button"
            aria-label={`React with ${label}`}
            aria-pressed={isSelected}
            onClick={() => handleClick(emoji)}
            style={{
              background: isSelected ? 'var(--surface-bg)' : 'transparent',
              border: isSelected ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
              borderRadius: '9999px',
              padding: '6px 10px',
              fontSize: '1.25rem',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, border-color 0.2s ease, background 0.2s ease',
              transform: isSelected ? 'scale(1.15)' : 'scale(1)',
            }}
          >
            {emoji}
          </button>
        )
      })}

      {floaters.map((f) => (
        <span
          key={f.id}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            fontSize: '1.5rem',
            pointerEvents: 'none',
            animation: 'reaction-float-up 0.7s ease-out forwards',
          }}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  )
}
