'use client'

import { CodewordsTeamBadge } from '@/components/codewords/CodewordsBoardGrid'
import { lobbyTeamSummary, otherTeam } from '@/lib/codewords'
import type { CodewordsPlayerRole, CodewordsTeam, Player } from '@/types'

function TeamSummaryLine({ team, roles }: { team: CodewordsTeam; roles: CodewordsPlayerRole[] }) {
  const summary = lobbyTeamSummary(roles, team)
  return (
    <p className="text-faint text-[11px] tabular-nums">
      {summary.total} player{summary.total === 1 ? '' : 's'} · {summary.spymasters} spymaster
      {summary.spymasters === 1 ? '' : 's'}
    </p>
  )
}

function PlayerRow({
  player,
  role,
  team,
  saving,
  readOnly,
  onSetSpymaster,
  onMoveTeam,
}: {
  player: Player
  role: CodewordsPlayerRole
  team: CodewordsTeam
  saving: boolean
  readOnly?: boolean
  onSetSpymaster: (playerId: string, team: CodewordsTeam) => void
  onMoveTeam: (playerId: string, team: CodewordsTeam) => void
}) {
  const other = otherTeam(team)
  const isSpymaster = role.role === 'spymaster'

  if (readOnly) {
    return (
      <div className="flex items-center gap-2 px-2 py-2 min-h-[2.75rem]">
        <span className="w-8 text-center shrink-0">{isSpymaster ? '🕵️' : ''}</span>
        <span className="min-w-0 text-sm font-semibold text-[var(--foreground)] truncate" title={player.name}>
          {player.name}
        </span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[2rem_1fr_2.25rem] items-center gap-2 px-2 py-2 rounded-lg hover:bg-[var(--surface-inset-bg)]/80 min-h-[2.75rem]">
      <button
        type="button"
        onClick={() => onSetSpymaster(player.id, team)}
        disabled={saving}
        title={isSpymaster ? `${player.name} is spymaster — tap to make operative` : `Make ${player.name} spymaster`}
        className={[
          'h-8 w-8 rounded-lg border text-sm flex items-center justify-center shrink-0 transition-colors disabled:opacity-50',
          isSpymaster
            ? 'border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-100'
            : 'border-[var(--border-strong)] text-faint hover:text-[var(--foreground)]',
        ].join(' ')}
        aria-label={isSpymaster ? `Remove spymaster from ${player.name}` : `Make ${player.name} spymaster`}
      >
        {isSpymaster ? '🕵️' : '☆'}
      </button>
      <span className="min-w-0 text-sm font-semibold text-[var(--foreground)] truncate" title={player.name}>
        {player.name}
      </span>
      <button
        type="button"
        onClick={() => onMoveTeam(player.id, other)}
        disabled={saving}
        title={`Move ${player.name} to ${other} team`}
        className="h-8 w-9 rounded-lg border border-[var(--border-strong)] text-base font-bold text-muted hover:text-[var(--foreground)] hover:border-[var(--foreground)]/20 disabled:opacity-50"
        aria-label={`Move ${player.name} to ${other} team`}
      >
        {team === 'red' ? '→' : '←'}
      </button>
    </div>
  )
}

function UnassignedRow({
  player,
  saving,
  onMoveTeam,
}: {
  player: Player
  saving: boolean
  onMoveTeam: (playerId: string, team: CodewordsTeam) => void
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2 py-2 rounded-lg hover:bg-[var(--surface-inset-bg)]/80 min-h-[2.75rem]">
      <span className="min-w-0 text-sm font-semibold text-[var(--foreground)] truncate" title={player.name}>
        {player.name}
      </span>
      <button
        type="button"
        onClick={() => onMoveTeam(player.id, 'red')}
        disabled={saving}
        className="text-[11px] font-bold rounded-lg border border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-100 px-2.5 py-1.5 disabled:opacity-50"
      >
        ← Red
      </button>
      <button
        type="button"
        onClick={() => onMoveTeam(player.id, 'blue')}
        disabled={saving}
        className="text-[11px] font-bold rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-100 px-2.5 py-1.5 disabled:opacity-50"
      >
        Blue →
      </button>
    </div>
  )
}

function TeamColumn({
  team,
  players,
  roles,
  savingRoleFor,
  readOnly,
  onSetSpymaster,
  onMoveTeam,
}: {
  team: CodewordsTeam
  players: Player[]
  roles: CodewordsPlayerRole[]
  savingRoleFor: string | null
  readOnly?: boolean
  onSetSpymaster: (playerId: string, team: CodewordsTeam) => void
  onMoveTeam: (playerId: string, team: CodewordsTeam) => void
}) {
  const roleByPlayer = new Map(roles.map((r) => [r.player_id, r]))
  const roster = players
    .map((player) => {
      const role = roleByPlayer.get(player.id)
      return role?.team === team ? { player, role } : null
    })
    .filter(Boolean) as { player: Player; role: CodewordsPlayerRole }[]

  const borderClass = team === 'red' ? 'border-red-500/35 bg-red-500/5' : 'border-blue-500/35 bg-blue-500/5'

  return (
    <div className={`rounded-xl border ${borderClass} flex flex-col min-h-0`}>
      <div className="px-3 py-2 border-b border-[var(--border-strong)]/60 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <CodewordsTeamBadge team={team} />
          <span className="text-xs font-bold tabular-nums">{roster.length}</span>
        </div>
        <TeamSummaryLine team={team} roles={roles} />
      </div>
      <p className="text-[10px] text-faint px-3 pt-2 uppercase tracking-wider">
        {readOnly ? '🕵️ = spymaster' : '🕵️ = spymaster · arrow = move team'}
      </p>
      <div className="flex-1 min-h-0 max-h-80 overflow-y-auto p-1">
        {roster.length === 0 ? (
          <p className="text-faint text-xs text-center py-6 px-2">No players yet</p>
        ) : (
          roster.map(({ player, role }) => (
            <PlayerRow
              key={player.id}
              player={player}
              role={role}
              team={team}
              saving={savingRoleFor === player.id}
              readOnly={readOnly}
              onSetSpymaster={onSetSpymaster}
              onMoveTeam={onMoveTeam}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function CodewordsLobbyRoster({
  players,
  roles,
  savingRoleFor,
  readOnly = false,
  onSetSpymaster,
  onMoveTeam,
}: {
  players: Player[]
  roles: CodewordsPlayerRole[]
  savingRoleFor: string | null
  readOnly?: boolean
  onSetSpymaster: (playerId: string, team: CodewordsTeam) => void
  onMoveTeam: (playerId: string, team: CodewordsTeam) => void
}) {
  const roleByPlayer = new Map(roles.map((r) => [r.player_id, r]))
  const unassigned = players.filter((p) => !roleByPlayer.has(p.id))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TeamColumn
          team="red"
          players={players}
          roles={roles}
          savingRoleFor={savingRoleFor}
          readOnly={readOnly}
          onSetSpymaster={onSetSpymaster}
          onMoveTeam={onMoveTeam}
        />
        <TeamColumn
          team="blue"
          players={players}
          roles={roles}
          savingRoleFor={savingRoleFor}
          readOnly={readOnly}
          onSetSpymaster={onSetSpymaster}
          onMoveTeam={onMoveTeam}
        />
      </div>

      {unassigned.length > 0 && (
        <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-inset-bg)]/40">
          <div className="px-3 py-2 border-b border-[var(--border-strong)]/60 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Unassigned</p>
            <span className="text-xs font-bold tabular-nums text-faint">{unassigned.length}</span>
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {unassigned.map((player) =>
              readOnly ? (
                <div key={player.id} className="px-2 py-2 text-sm font-semibold truncate" title={player.name}>
                  {player.name}
                </div>
              ) : (
                <UnassignedRow
                  key={player.id}
                  player={player}
                  saving={savingRoleFor === player.id}
                  onMoveTeam={onMoveTeam}
                />
              )
            )}
          </div>
          {!readOnly && (
            <p className="text-faint text-[11px] px-3 pb-2 leading-relaxed">
              Use ← Red or Blue → to add players to a team.
            </p>
          )}
          {readOnly && (
            <p className="text-faint text-[11px] px-3 pb-2 leading-relaxed">
              Return to lobby to assign these players.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
