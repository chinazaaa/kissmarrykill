'use client'

import { useEffect, useRef } from 'react'
import type { AnonymousMessage } from '@/types'

interface AnonymousMessageFeedProps {
  messages: AnonymousMessage[]
  title?: string
  emptyLabel?: string
  readOnly?: boolean
}

export function AnonymousMessageFeed({
  messages,
  title = 'Anonymous messages',
  emptyLabel = 'No messages yet — be the first to post',
  readOnly = false,
}: AnonymousMessageFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(messages.length)

  useEffect(() => {
    if (messages.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevCountRef.current = messages.length
  }, [messages.length])

  return (
    <div className="glass-card border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-muted text-xs uppercase tracking-wider">{title}</p>
        <span className="text-faint text-xs tabular-nums">{messages.length}</span>
      </div>

      <div ref={scrollRef} className="max-h-[min(52vh,28rem)] overflow-y-auto space-y-2 scrollbar-thin">
        {messages.length === 0 ? (
          <p className="text-muted text-sm text-center py-8">{emptyLabel}</p>
        ) : (
          messages.map((message, i) => (
            <div
              key={message.id}
              className="confession-slide-in px-3 py-2.5 rounded-xl bg-white/5 border border-white/5"
              style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
            >
              <p className="text-body-muted text-sm leading-relaxed">&ldquo;{message.text}&rdquo;</p>
              <p className="text-faint text-[10px] mt-1.5">{new Date(message.created_at).toLocaleTimeString()}</p>
            </div>
          ))
        )}
      </div>

      {readOnly && messages.length > 0 && (
        <p className="text-faint text-xs">Messages stay anonymous — no names are shown.</p>
      )}

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
