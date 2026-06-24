import Link from 'next/link'

type RoomGame = {
  id: string
  game_id: string
  created_at: string
  started_by_member_id: string | null
  room_members: { display_name: string } | null
  games: { title: string; game_type: string; status: string } | null
}

const GAME_TYPE_EMOJI: Record<string, string> = {
  smash_marry_kill: '💋',
  red_flag_green_flag: '🚩',
  smash_or_pass: '🔥',
  would_you_rather: '🤔',
  most_likely_to: '👑',
  who_said_this: '💬',
  hot_seat: '🪑',
  custom: '🎮',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function RoomGameHistory({ games }: { games: RoomGame[] }) {
  if (games.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-faint text-sm text-center">
          Your game history will appear here after you start your first game from this room.
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-[var(--border)]">
      {games.map((g) => {
        const emoji = GAME_TYPE_EMOJI[g.games?.game_type ?? ''] ?? '🎮'
        const isFinished = g.games?.status === 'finished'
        return (
          <div key={g.id} className="flex items-center gap-3 py-3 px-3">
            <span className="text-2xl shrink-0">{emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-body text-sm truncate">{g.games?.title ?? 'Game'}</p>
              <p className="text-xs text-faint">
                {formatDate(g.created_at)}
                {g.room_members?.display_name && ` · by ${g.room_members.display_name}`}
              </p>
            </div>
            {isFinished ? (
              <Link
                href={`/game/${g.game_id}`}
                className="btn-secondary btn-fit shrink-0 px-3 py-1.5 text-xs"
              >
                Results
              </Link>
            ) : (
              <Link
                href={`/game/${g.game_id}`}
                className="shrink-0 text-xs font-semibold text-[var(--primary)] hover:underline"
              >
                Join →
              </Link>
            )}
          </div>
        )
      })}
    </div>
  )
}
