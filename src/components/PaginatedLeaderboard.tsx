'use client'

import { useEffect } from 'react'
import { ResultsPagination, usePagination, RESULTS_PAGE_SIZE } from '@/components/ui/ResultsPagination'

export interface LeaderboardRow {
  id: string
  name: string
  score: number
  rank?: number
  correctCount?: number
}

interface PaginatedLeaderboardProps {
  title: string
  rows: LeaderboardRow[]
  pageSize?: number
  highlightId?: string | null
  scoreLabel?: (score: number) => string
  totalQuestions?: number
}

export function PaginatedLeaderboard({
  title,
  rows,
  pageSize = RESULTS_PAGE_SIZE,
  highlightId,
  scoreLabel = (n) => `${n} correct`,
  totalQuestions,
}: PaginatedLeaderboardProps) {
  const { page, totalPages, start, end, setPage, reset } = usePagination(rows.length, pageSize)

  useEffect(() => {
    reset()
  }, [rows.length, reset])

  if (rows.length === 0) return null

  const pageRows = rows.slice(start, end)

  return (
    <div className="glass-card p-5 space-y-3">
      <p className="text-muted text-xs uppercase tracking-wider">{title}</p>
      <div className="space-y-2">
        {pageRows.map((row, i) => (
          <div key={row.id} className="flex items-center justify-between gap-2 text-sm">
            <span className={row.id === highlightId ? 'label-teal font-semibold' : 'text-body'}>
              {row.rank ?? start + i + 1}. {row.name}
              {row.id === highlightId ? ' (you)' : ''}
            </span>
            <div className="text-right shrink-0">
              <div className="text-muted">{scoreLabel(row.score)}</div>
              {row.correctCount !== undefined && totalQuestions !== undefined && (
                <div className="text-xs text-faint tabular-nums">
                  {row.correctCount}/{totalQuestions}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <ResultsPagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={rows.length}
        pageSize={pageSize}
        noun="players"
      />
    </div>
  )
}
