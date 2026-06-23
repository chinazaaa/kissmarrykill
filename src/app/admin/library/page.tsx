'use client'

import { useEffect, useState } from 'react'
import { Chip } from '@/components/ui/PageShell'

interface QuestionPack {
  id: string
  title: string
  game_type: string
  author_name: string
  description: string | null
  question_count: number
  questions: unknown[]
  status: string
  created_at: string
  approved_at: string | null
}

const GAME_TYPE_META: Record<string, { label: string; color: string }> = {
  trivia: { label: 'Trivia', color: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/25' },
  would_you_rather: {
    label: 'Would You Rather',
    color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25',
  },
  most_likely_to: {
    label: 'Most Likely To',
    color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25',
  },
}

const STATUSES = ['pending', 'approved', 'rejected'] as const
type Status = (typeof STATUSES)[number]

export default function AdminLibraryPage() {
  const [tab, setTab] = useState<Status>('pending')
  const [packs, setPacks] = useState<QuestionPack[]>([])
  const [loading, setLoading] = useState(true)

  const load = (status: Status) => {
    setLoading(true)
    fetch(`/api/admin/library?status=${status}`)
      .then((r) => r.json())
      .then((d) => setPacks(d.packs ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(tab)
  }, [tab])

  const action = async (id: string, act: 'approve' | 'reject') => {
    setPacks((prev) => prev.filter((p) => p.id !== id))
    await fetch(`/api/admin/library/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: act }),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight gradient-title">Question Library</h1>
        <p className="text-muted text-sm mt-1">Review and approve community-submitted packs</p>
      </div>

      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <Chip key={s} active={tab === s} onClick={() => setTab(s)}>
            <span className="capitalize">{s}</span>
          </Chip>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card p-5 animate-pulse space-y-3">
              <div className="h-4 bg-[var(--border-strong)] rounded-full w-1/2" />
              <div className="h-3 bg-[var(--border)] rounded-full w-1/3" />
              <div className="h-3 bg-[var(--border)] rounded-full w-2/3" />
            </div>
          ))}
        </div>
      ) : packs.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-muted text-sm">No {tab} packs.</p>
        </div>
      ) : (
        <div className="space-y-4 animate-stagger">
          {packs.map((pack) => (
            <PackCard key={pack.id} pack={pack} onAction={action} showActions={tab === 'pending'} />
          ))}
        </div>
      )}
    </div>
  )
}

function PackCard({
  pack,
  onAction,
  showActions,
}: {
  pack: QuestionPack
  onAction: (id: string, act: 'approve' | 'reject') => void
  showActions: boolean
}) {
  const preview = (pack.questions as unknown[]).slice(0, 5)
  const meta = GAME_TYPE_META[pack.game_type]

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <p className="font-bold leading-snug">{pack.title}</p>
          <p className="text-muted text-sm">by {pack.author_name}</p>
        </div>
        <span className={`label-caps shrink-0 rounded-full border px-2.5 py-1 text-[10px] ${meta?.color ?? 'chip'}`}>
          {meta?.label ?? pack.game_type}
        </span>
      </div>

      {pack.description && <p className="text-muted text-sm leading-relaxed">{pack.description}</p>}

      <div className="flex gap-4 text-xs text-faint">
        <span>{pack.question_count} questions</span>
        <span>Submitted {new Date(pack.created_at).toLocaleDateString()}</span>
        {pack.approved_at && <span>Approved {new Date(pack.approved_at).toLocaleDateString()}</span>}
      </div>

      {preview.length > 0 && (
        <div className="surface-inset px-4 py-3 space-y-2">
          <p className="label-caps text-faint">Preview</p>
          <div className="space-y-1.5">
            {preview.map((q, i) => (
              <p key={i} className="text-xs text-muted truncate leading-relaxed">
                {i + 1}. {previewText(pack.game_type, q)}
              </p>
            ))}
          </div>
        </div>
      )}

      {showActions && (
        <div className="flex gap-2 pt-1 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => onAction(pack.id, 'approve')}
            className="btn-primary btn-fit px-5 py-2 text-sm"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => onAction(pack.id, 'reject')}
            className="btn-secondary btn-fit px-5 py-2 text-sm"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

function previewText(gameType: string, q: unknown): string {
  if (typeof q === 'string') return q
  if (!q || typeof q !== 'object') return String(q)
  const obj = q as Record<string, unknown>
  if (gameType === 'trivia') return String(obj.question ?? '')
  if (gameType === 'would_you_rather') return `${obj.optionA} or ${obj.optionB}`
  return JSON.stringify(q)
}
