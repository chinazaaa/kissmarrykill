'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageShell, Chip } from '@/components/ui/PageShell'

interface PackSummary {
  id: string
  title: string
  game_type: 'trivia' | 'would_you_rather' | 'most_likely_to'
  author_name: string
  description: string | null
  question_count: number
  approved_at: string
}

const GAME_TYPE_META: Record<string, { label: string; color: string }> = {
  trivia: { label: 'Trivia', color: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/25' },
  would_you_rather: { label: 'Would You Rather', color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25' },
  most_likely_to: { label: 'Most Likely To', color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25' },
}

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'trivia', label: 'Trivia' },
  { value: 'would_you_rather', label: 'Would You Rather' },
  { value: 'most_likely_to', label: 'Most Likely To' },
]

export default function LibraryPage() {
  const [packs, setPacks] = useState<PackSummary[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const url = filter ? `/api/library?game_type=${filter}` : '/api/library'
    fetch(url)
      .then((r) => r.json())
      .then((d) => setPacks(d.packs ?? []))
      .finally(() => setLoading(false))
  }, [filter])

  return (
    <PageShell>
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight gradient-title">Question Library</h1>
            <p className="text-muted text-sm mt-1">Community-made packs for your games</p>
          </div>
          <Link
            href="/library/submit"
            className="btn-secondary btn-fit px-4 py-2 text-sm no-underline shrink-0 mt-1"
          >
            + Submit a pack
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="h-4 bg-[var(--border-strong)] rounded-full w-2/3 mb-3" />
              <div className="h-3 bg-[var(--border)] rounded-full w-1/3" />
            </div>
          ))}
        </div>
      ) : packs.length === 0 ? (
        <div className="glass-card p-10 text-center space-y-3">
          <p className="text-4xl">📚</p>
          <p className="font-semibold">No packs yet</p>
          <p className="text-muted text-sm">
            {filter ? 'No approved packs for this category.' : 'Be the first to submit one!'}
          </p>
          <Link
            href="/library/submit"
            className="btn-primary inline-block no-underline mt-2"
            style={{ width: 'fit-content', margin: '0 auto' }}
          >
            Submit a pack
          </Link>
        </div>
      ) : (
        <div className="space-y-3 animate-stagger">
          {packs.map((pack) => {
            const meta = GAME_TYPE_META[pack.game_type]
            return (
              <div key={pack.id} className="glass-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-bold leading-snug">{pack.title}</p>
                    <p className="text-muted text-sm">by {pack.author_name}</p>
                  </div>
                  <span
                    className={`label-caps shrink-0 rounded-full border px-2.5 py-1 text-[10px] ${meta?.color ?? 'chip'}`}
                  >
                    {meta?.label ?? pack.game_type}
                  </span>
                </div>
                {pack.description && (
                  <p className="text-muted text-sm line-clamp-2 leading-relaxed">{pack.description}</p>
                )}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-faint text-xs">{pack.question_count} questions</span>
                  <Link
                    href={`/create?pack=${pack.id}&game_type=${pack.game_type}`}
                    className="btn-secondary btn-fit px-4 py-1.5 text-sm no-underline"
                  >
                    Use this pack →
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
